import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Storage } from "./storage";
import { auth, db as firestore } from "./firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginOffline: () => void;
  logout: () => void;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ['ezypromo1991@gmail.com', 'admin@pos.com', 'admin@cbk.com'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(Storage.get("user"));
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(Storage.get("isGuest") === true);

  useEffect(() => {
    // Ensure persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsGuest(false);
        Storage.set("isGuest", false);
        try {
          // Fetch user metadata from Firestore
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let userData: any = null;

          if (userDoc.exists()) {
            userData = userDoc.data();
            // Force admin role for specific emails even if DB says otherwise
            if (ADMIN_EMAILS.includes(firebaseUser.email || "")) {
              userData.role = "admin";
            }
          } else {
            // Provision the user document if it doesn't exist
            userData = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || (ADMIN_EMAILS.includes(firebaseUser.email || "") ? "Admin" : (firebaseUser.email === 'user@mariz.com' ? "GCash Terminal" : (firebaseUser.email === 'user@cbk.com' ? "Staff" : "User"))),
              email: firebaseUser.email || "",
              role: ADMIN_EMAILS.includes(firebaseUser.email || "") ? "admin" : "cashier",
              created_at: new Date().toISOString()
            };
            try {
              await setDoc(userDocRef, userData);
            } catch (e) {
              console.warn("Could not provision user doc, rules might be strict:", e);
              // We'll proceed with local-only user if setDoc fails
            }
          }

          const userObj: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: userData.name || firebaseUser.displayName || "User",
            role: userData.role || "cashier"
          };
          setUser(userObj);
          Storage.set("user", userObj);
        } catch (err) {
          console.error("Error fetching user metadata:", err);
          // If we fail to fetch, we still have the firebase auth session, 
          // but we might be missing specific role info.
          const fallbackUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || (ADMIN_EMAILS.includes(firebaseUser.email || "") ? "Admin" : (firebaseUser.email === 'user@mariz.com' ? "GCash Terminal" : (firebaseUser.email === 'user@cbk.com' ? "Staff" : "User"))),
            role: ADMIN_EMAILS.includes(firebaseUser.email || "") ? "admin" : "cashier"
          };
          setUser(fallbackUser);
        }
      } else {
        if (!isGuest) {
          setUser(null);
          Storage.remove("user");
        }
        Storage.remove("token");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isGuest]);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Auth Exception Details:", {
        code: err.code,
        message: err.message,
        email: email,
        context: "Email/Password Login"
      });
      // We throw the original error so the UI can handle the code
      throw err;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      // Metadata provision is handled by onAuthStateChanged hook
    } catch (err: any) {
      console.error("Signup Error:", err);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Login Error:", err);
      throw err;
    }
  };

  const loginOffline = () => {
    const guestUser: User = {
      id: "guest_" + Math.random().toString(36).substr(2, 9),
      name: "Offline Admin",
      email: "offline@local.pos",
      role: "admin"
    };
    setUser(guestUser);
    setIsGuest(true);
    Storage.set("user", guestUser);
    Storage.set("isGuest", true);
  };

  const logout = async () => {
    await signOut(auth);
    Storage.remove("user");
    Storage.remove("token");
    Storage.remove("isGuest");
    setUser(null);
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        loginWithGoogle,
        loginOffline,
        logout,
        isLoggedIn: !!user,
        isAdmin: user?.role === "admin",
        isGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
