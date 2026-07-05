import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage, RegisterPage, ProtectedRoute } from '../features/auth';
import { HomePage } from '../features/flipbooks';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
