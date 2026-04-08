import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminV2App } from '../features/admin-v2/AdminV2App'
import { QuizRunner } from '../features/quiz/QuizRunner'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/q/:slug" element={<QuizRunner />} />
        <Route path="/admin" element={<AdminV2App />} />
      </Routes>
    </BrowserRouter>
  )
}
