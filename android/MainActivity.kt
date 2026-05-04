/**
 * SwiftPOS Android WebView Container
 * Wraps the PWA in a native Android app with full offline support
 *
 * Package: com.swiftpos.app
 * Requires: Android API 21+ (Android 5.0+)
 */

package com.swiftpos.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout

    // Replace with your server IP when running on real device
    // For emulator: http://10.0.2.2:5000
    // For real device: http://YOUR_COMPUTER_IP:5000
    private val SERVER_URL = "http://10.0.2.2:5000"
    private val FALLBACK_URL = "file:///android_asset/index.html"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        progressBar = findViewById(R.id.progress_bar)
        swipeRefresh = findViewById(R.id.swipe_refresh)
        webView = findViewById(R.id.web_view)

        setupWebView()
        setupSwipeRefresh()
        setupBackNavigation()
        setupNetworkMonitor()
        requestPermissions()

        // Load app
        loadApp()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings

        // ── JavaScript & DOM Storage ───────────────────────────────────────
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true           // Required for localStorage
        settings.databaseEnabled = true             // Required for IndexedDB
        settings.javaScriptCanOpenWindowsAutomatically = true

        // ── Caching ────────────────────────────────────────────────────────
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setAppCacheEnabled(true)           // Enable app cache for PWA

        // ── Media & Files ──────────────────────────────────────────────────
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        // ── Display ────────────────────────────────────────────────────────
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.displayZoomControls = false
        settings.builtInZoomControls = false

        // ── Mixed Content (allow HTTP API calls from HTTPS) ────────────────
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        // ── User Agent (identify as PWA app) ──────────────────────────────
        settings.userAgentString = "SwiftPOS-Android/1.0 ${settings.userAgentString}"

        // ── WebViewClient: Handle navigation and errors ────────────────────
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 0
            }

            override fun onPageFinished(view: WebView, url: String) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false

                // Inject server URL config for the app
                val configScript = """
                    window._POS_CONFIG = {
                        apiUrl: '$SERVER_URL/api',
                        businessName: 'SwiftPOS Store',
                        businessAddress: 'Your Store Address',
                        businessPhone: '+63 XXX XXX XXXX'
                    };
                """.trimIndent()
                view.evaluateJavascript(configScript, null)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    progressBar.visibility = View.GONE
                    // Try loading offline cached version
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        if (error.errorCode == ERROR_HOST_LOOKUP || error.errorCode == ERROR_CONNECT) {
                            Toast.makeText(this@MainActivity, "Working offline", Toast.LENGTH_SHORT).show()
                            view.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                            view.reload()
                        }
                    }
                }
            }

            // Allow navigation within the SPA
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return if (url.startsWith(SERVER_URL) || url.startsWith("file://")) {
                    false // Let WebView handle it
                } else {
                    // Open external URLs in browser
                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, request.url)
                    startActivity(intent)
                    true
                }
            }
        }

        // ── WebChromeClient: Handle JS dialogs, permissions ────────────────
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress == 100) progressBar.visibility = View.GONE
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                android.util.Log.d("SwiftPOS-JS",
                    "${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}")
                return true
            }

            // Handle permission requests from WebView (camera for barcode)
            override fun onPermissionRequest(request: PermissionRequest) {
                val allowedResources = arrayOf(
                    PermissionRequest.RESOURCE_AUDIO_CAPTURE,
                    PermissionRequest.RESOURCE_VIDEO_CAPTURE
                )
                val allowed = request.resources.filter { it in allowedResources }.toTypedArray()
                if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
            }

            // Handle JS alerts
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result.confirm() }
                    .setCancelable(false)
                    .show()
                return true
            }

            // Handle JS confirms
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result.confirm() }
                    .setNegativeButton("Cancel") { _, _ -> result.cancel() }
                    .show()
                return true
            }
        }

        // Add JavaScript interface for native features
        webView.addJavascriptInterface(AndroidBridge(this), "AndroidBridge")
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(
            ContextCompat.getColor(this, android.R.color.holo_blue_bright)
        )
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    // Ask before exiting
                    androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                        .setMessage("Exit SwiftPOS?")
                        .setPositiveButton("Exit") { _, _ -> finish() }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
            }
        })
    }

    private fun setupNetworkMonitor() {
        val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            connectivityManager.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    runOnUiThread {
                        webView.evaluateJavascript("window.dispatchEvent(new Event('online'))", null)
                    }
                }
                override fun onLost(network: Network) {
                    runOnUiThread {
                        webView.evaluateJavascript("window.dispatchEvent(new Event('offline'))", null)
                        Toast.makeText(this@MainActivity, "⚠ No connection - offline mode", Toast.LENGTH_SHORT).show()
                    }
                }
            })
        }
    }

    private fun requestPermissions() {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA)
        }
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), 100)
        }
    }

    private fun loadApp() {
        // Check network first
        val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val isOnline = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            connectivityManager.getNetworkCapabilities(connectivityManager.activeNetwork)
                ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        } else {
            connectivityManager.activeNetworkInfo?.isConnected == true
        }

        if (isOnline) {
            webView.loadUrl(SERVER_URL)
        } else {
            // Load offline - use cached service worker content
            webView.settings.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
            webView.loadUrl(SERVER_URL)
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}

/**
 * JavaScript Bridge
 * Exposes native Android features to the web app
 */
class AndroidBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        return """{"platform":"android","version":"${Build.VERSION.SDK_INT}","model":"${Build.MODEL}"}"""
    }

    @JavascriptInterface
    fun vibrate(duration: Long) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = activity.getSystemService(android.os.VibratorManager::class.java)
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            activity.getSystemService(android.os.Vibrator::class.java)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(android.os.VibrationEffect.createOneShot(duration, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }

    @JavascriptInterface
    fun printReceipt(receiptHtml: String) {
        // Implement Bluetooth thermal printer integration here
        activity.runOnUiThread {
            Toast.makeText(activity, "Printing... (implement BT printer)", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun openCashDrawer() {
        // TODO: Add actual printer/drawer integration for Logicowl OJ-100 here.
        // Example ESC/POS drawer kick command: 1B 70 00 19 FA
        activity.runOnUiThread {
            Toast.makeText(activity, "Opening cash drawer...", Toast.LENGTH_SHORT).show()
        }
    }
}
