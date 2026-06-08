const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/pages/Login.tsx');
let content = fs.readFileSync(file, 'utf8');

// remove isRegistering state
content = content.replace(/const \[isRegistering, setIsRegistering\] = useState\(false\);\n/, '');

// remove handling of isRegistering inside handleSubmit
content = content.replace(/      if \(isRegistering\) \{\n[\s\S]*?\} else \{\n        await login\(trimmedEmail, password\);\n      \}/, '      await login(trimmedEmail, password);');
content = content.replace(/        if \(isRegistering\) \{\n          setError\("Your signup request was rejected.*?else \{\n          setError\("Incorrect security key or username. If you haven't created an account yet, please 'Sign Up' first. If you previously used Google Login, please use it again."\);\n        \}/s, '        setError("Incorrect security key or username.");');

// remove headers
content = content.replace(/\{isRegistering \? "Create New Account" : "Management Portal"\}/, '"Management Portal"');

// remove name input block
content = content.replace(/            \{isRegistering && \(\n[\s\S]*?\n            \)\}\n\n/, '');

// remove sign up toggle button
const toggleButtonRegex = /             <div className="flex justify-end">\n                <button \n                  type="button"\n                  onClick=\{\(\) => \{\n                    setIsRegistering\(!isRegistering\);\n                    setError\(null\);\n                  \}\}\n                  className="text-\[9px\] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"\n                >\n                  \{isRegistering \? "Existing User\? Login" : "New Account\? Sign Up"\}\n                <\/button>\n             <\/div>\n\n/;
content = content.replace(toggleButtonRegex, '');

// update submit button
content = content.replace(/\{isRegistering \? "Registering\.\.\." : "Authenticating\.\.\."\}/g, '"Authenticating..."');
content = content.replace(/\{isRegistering \? "CREATE ACCOUNT" : "ACCOUNT LOGIN"\}/g, '"ACCOUNT LOGIN"');

// remove google sign in block
const googleBlockRegex = /            <div className="relative my-6">\n              <div className="absolute inset-0 flex items-center">\n                <span className="w-full border-t border-white\/5" \/>\n              <\/div>\n              <div className="relative flex justify-center text-\[8px\] uppercase tracking-\[0\.3em\]">\n                <span className="bg-\[#15161d\] px-2 text-slate-600">Or use socials<\/span>\n              <\/div>\n            <\/div>\n\n            <button\n              type="button"\n              onClick=\{async \(\) => \{\n                setError\(null\);\n                try \{\n                  await loginWithGoogle\(\);\n                \} catch \(err: any\) \{\n                  if \(err\.code === 'auth\/network-request-failed'\) \{\n                    setError\("Network error\. Please check your internet connection or ad-blocker settings\."\);\n                  \} else if \(err\.code === 'auth\/popup-closed-by-user'\) \{\n                    setError\("Login popup closed\. Please try again\."\);\n                  \} else \{\n                    setError\("Google authentication failed\."\);\n                  \}\n                \}\n              \}\}\n              className="w-full bg-white\/5 hover:bg-white\/10 border border-white\/5 text-white text-\[9px\] font-black uppercase tracking-\[0\.2em\] py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"\n            >\n              <svg className="w-4 h-4" viewBox="0 0 24 24">\n                <path fill="currentColor" d="M22\.56 12\.25c0-\.78-\.07-1\.53-\.2-2\.25H12v4\.26h5\.92c-\.26 1\.37-1\.04 2\.53-2\.21 3\.31v2\.77h3\.57c2\.08-1\.92 3\.28-4\.74 3\.28-8\.09z" \/>\n                <path fill="currentColor" d="M12 23c2\.97 0 5\.46-\.98 7\.28-2\.66l-3\.57-2\.77c-\.98\.66-2\.23 1\.06-3\.71 1\.06-2\.86 0-5\.29-1\.93-6\.16-4\.53H2\.18v2\.84C3\.99 20\.53 7\.7 23 12 23z" \/>\n                <path fill="currentColor" d="M5\.84 14\.09c-\.22-\.66-\.35-1\.36-\.35-2\.09s\.13-1\.43\.35-2\.09V7\.07H2\.18C1\.43 8\.55 1 10\.22 1 12s\.43 3\.45 1\.18 4\.93l3\.66-2\.84z" \/>\n                <path fill="currentColor" d="M12 5\.38c1\.62 0 3\.06\.56 4\.21 1\.64l3\.15-3\.15C17\.45 2\.09 14\.97 1 12 1 7\.7 1 3\.99 3\.47 2\.18 7\.07l3\.66 2\.84c\.87-2\.6 3\.3-4\.53 6\.16-4\.53z" \/>\n              <\/svg>\n              Google Sign In\n            <\/button>\n\n/s;
content = content.replace(googleBlockRegex, '');

fs.writeFileSync(file, content);
console.log('done replacing');
