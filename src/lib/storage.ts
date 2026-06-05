export const Storage = {
  set: (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  get: (key: string) => {
    const val = localStorage.getItem(key);
    try {
      return val ? JSON.parse(val) : null;
    } catch {
      return val;
    }
  },
  remove: (key: string) => {
    localStorage.removeItem(key);
  },
  clear: () => {
    localStorage.clear();
  },
};
