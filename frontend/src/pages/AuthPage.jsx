import AuthShell from '../components/AuthShell'
import Login from './Login'
import Register from './Register'

// /login and /register both show this page. The shell (left panel and the switch) stays in place,
// so moving between the two only slides the pill and fades the form.
export default function AuthPage({ mode }) {
  return <AuthShell mode={mode}>{mode === 'login' ? <Login /> : <Register />}</AuthShell>
}
