const API = (() => {
  const getBaseUrl = () => {
    const { hostname, port, protocol } = window.location;
    if (protocol === 'file:') {
      return window._POS_CONFIG?.apiUrl || 'http://10.0.2.2:5000/api';
    }
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
  };

  const BASE_URL = getBaseUrl();

  const request = async (method, endpoint, data = null, options = {}) => {
    const token = Storage.get('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const config = { method, headers, signal: options.signal };
    if (data && method !== 'GET') config.body = JSON.stringify(data);

    let url = `${BASE_URL}${endpoint}`;
    if (data && method === 'GET') {
      const params = new URLSearchParams(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
      if (params.toString()) url += '?' + params.toString();
    }

    try {
      const response = await fetch(url, config);
      if (response.status === 401) {
        const res = await response.json().catch(() => ({}));
        Storage.clear();
        window.App?.navigate('login');
        throw new ApiError(res.message || 'Unauthorized', 401);
      }
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new ApiError(json.message || `Request failed (${response.status})`, response.status, json.errors);
      }
      return json;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        window.dispatchEvent(new CustomEvent('pos:offline'));
        throw new ApiError('No internet connection.', 0, null, true);
      }
      throw new ApiError(err.message || 'Network error', 0);
    }
  };

  return {
    get: (endpoint, params, opts) => request('GET', endpoint, params, opts),
    post: (endpoint, data, opts) => request('POST', endpoint, data, opts),
    put: (endpoint, data, opts) => request('PUT', endpoint, data, opts),
    patch: (endpoint, data, opts) => request('PATCH', endpoint, data, opts),
    delete: (endpoint, opts) => request('DELETE', endpoint, null, opts),
    BASE_URL,
  };
})();

class ApiError extends Error {
  constructor(message, status, errors = null, isOffline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.isOffline = isOffline;
  }
}

window.API = API;
window.ApiError = ApiError;
