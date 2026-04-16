import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AuthService } from '@/services'
import { clearCookie, getCookie, useQuery, useRouter } from '@/utils'

import { Checkbox, Form, Input } from '@/components'
import { isRegistrationDisabled, REDIRECT_COOKIE_NAME } from '@/consts'

import SocialLogin from './SocialLogin'

const Login = () => {
  const { t } = useTranslation()
  const query = useQuery()
  const router = useRouter()

  const approval = typeof query.approval === 'string' ? query.approval : undefined
  const email = typeof query.email === 'string' ? query.email : undefined

  let notice: string | undefined
  let noticeClassName = 'border-blue-500/20 bg-blue-500/10 text-blue-200'

  switch (approval) {
    case 'pending':
      notice = 'Your account request has been sent to the administrator and is waiting for approval.'
      break

    case 'approved':
      notice = 'Your account has been approved. Sign in to continue.'
      noticeClassName = 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
      break

    case 'invalid':
      notice = 'This approval link is invalid or has already been used.'
      noticeClassName = 'border-amber-500/20 bg-amber-500/10 text-amber-200'
      break

    case 'email-required':
      notice = 'This social login provider did not return a usable email address, so the account request could not be sent for approval.'
      noticeClassName = 'border-amber-500/20 bg-amber-500/10 text-amber-200'
      break
  }

  async function fetch(values: any) {
    await AuthService.login(values)

    const redirectUri = getCookie(REDIRECT_COOKIE_NAME) as string

    if (redirectUri) {
      clearCookie(REDIRECT_COOKIE_NAME)
      return router.redirect(redirectUri, {
        extend: false
      })
    }

    router.replace('/')
  }

  return (
    <div className="mx-auto grid w-[21.875rem] gap-6 py-12 lg:py-0">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold">{t('login.headline')}</h1>
        {!isRegistrationDisabled() && (
          <p className="text-secondary text-sm">
            <Trans
              t={t}
              i18nKey="login.subHeadline"
              components={{
                a: (
                  <Link
                    key="sign-up"
                    className="hover:text-primary underline underline-offset-4"
                    to="/sign-up"
                  />
                )
              }}
            />
          </p>
        )}
      </div>

      {notice && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${noticeClassName}`}>{notice}</div>
      )}

      <SocialLogin />

      <Form.Simple
        className="space-y-4"
        fetch={fetch}
        initialValues={{
          email,
          rememberMe: true
        }}
        submitProps={{
          label: t('login.title'),
          className: 'w-full'
        }}
      >
        <Form.Item
          name="email"
          label={t('login.email.label')}
          rules={[
            {
              required: true,
              message: t('login.email.required')
            },
            {
              type: 'email',
              message: t('login.email.invalid')
            }
          ]}
        >
          <Input type="email" />
        </Form.Item>

        <Form.Item
          name="password"
          label={
            <div className="flex items-center justify-between">
              <span>{t('login.password.label')}</span>
              <Link to="/forgot-password" className="text-sm underline" tabIndex={-1}>
                {t('login.forgotPassword')}
              </Link>
            </div>
          }
          rules={[
            {
              required: true,
              message: t('login.password.required')
            }
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item name="rememberMe" validateTrigger={[]}>
          {(control: any) => (
            <label className="flex cursor-pointer items-center gap-3 text-sm/6 select-none">
              <Checkbox
                value={Boolean(control.value)}
                onChange={value => control.onChange(value)}
              />
              <span className="text-secondary">Remember me on this device</span>
            </label>
          )}
        </Form.Item>
      </Form.Simple>
    </div>
  )
}

export default Login
