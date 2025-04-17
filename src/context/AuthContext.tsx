import React, { createContext, useContext, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '453239832523-lb2q434vg4e3ur1a99b4lbj1qihct290.apps.googleusercontent.com', // 👈 Reemplazá con tu Web Client ID de Firebase
});

type AuthContextType = {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(currentUser => {
      console.log('👤 Usuario autenticado:', currentUser?.uid);
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      console.log('🔐 Iniciando sesión con Google...');
      await GoogleSignin.hasPlayServices();

      await GoogleSignin.signIn(); // No necesitas datos acá
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) throw new Error('No se obtuvo ID token');

      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);

      console.log('✅ Login con Google exitoso');
      console.log('👤 Usuario Firebase:', auth().currentUser?.email);
    } catch (error: any) {
      console.error('❌ Error en Google Sign-In:', error?.message || error);
    }
  };

  const logout = async () => {
    try {
      await GoogleSignin.signOut();
      await auth().signOut();
      console.log('👋 Sesión cerrada');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
