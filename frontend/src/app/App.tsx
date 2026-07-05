import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage, RegisterPage, ProtectedRoute, isAuthenticated } from '../features/auth';

const LandingPage = lazy(() => import('../features/landing/pages/LandingPage'));
const MyFlipbooksPage = lazy(() => import('../features/flipbooks/pages/MyFlipbooksPage'));
const ExplorePage = lazy(() => import('../features/explore/pages/ExplorePage'));
const ArchivePage = lazy(() => import('../features/archive/pages/ArchivePage'));
const EditorPage = lazy(() => import('../features/editor/pages/EditorPage'));
const ViewerPage = lazy(() => import('../features/viewer/pages/ViewerPage'));

function Root() {
  // Signed-in users land in their library; visitors see the landing page
  return isAuthenticated() ? <Navigate to="/flipbooks" replace /> : <LandingPage />;
}

const fallback = (
  <div className="min-h-screen flex items-center justify-center font-body italic text-on-surface-variant">
    Turning the page…
  </div>
);

export default function App() {
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/flipbooks" element={<MyFlipbooksPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/book/:id" element={<ViewerPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
