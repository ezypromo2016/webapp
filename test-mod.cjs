const fs = require('fs');
const path = './src/pages/SendMoney.tsx';
let code = fs.readFileSync(path, 'utf8');

// The marker
const targetMarker = `<motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleTransfer}`;

const formEndMarker = `                  )}
                </button>
              </form>
            ))}`;

// Wait, the previous replacement partially ran!
// Let's check if the file currently has E-Load stuff in it using indexOf
console.log("has activeTab:", code.includes('activeTab'));
console.log("has Send Money text:", code.includes('Send Money'));
