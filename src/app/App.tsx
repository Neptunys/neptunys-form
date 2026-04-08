import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { defaultProjects, getActiveQuiz } from '../data/quizData'
import { AdminV2App } from '../features/admin-v2/AdminV2App'
import { QuizRunner } from '../features/quiz/QuizRunner'

const defaultQuizSlug = getActiveQuiz(defaultProjects[0]).slug

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/q/${defaultQuizSlug}`} replace />} />
        <Route path="/q/:slug" element={<QuizRunner />} />
        <Route path="/admin" element={<AdminV2App />} />
      </Routes>
    </BrowserRouter>
  )
}
