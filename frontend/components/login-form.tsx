"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { AxiosError } from "axios"
import Link from "next/link"
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react"

import api from "@/lib/api"
import { setAuth } from "@/lib/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { LowCorLogo } from "@/components/lowcor-logo"

interface LoginFormValues {
  email: string
  password: string
}

export function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setError(null)
    try {
      const response = await api.post("/auth/login", {
        email: data.email,
        password: data.password,
      })
      setAuth(response.data.access_token, response.data.user)
      router.push("/dashboard")
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string | string[] }>
      const status = axiosError.response?.status
      const body = axiosError.response?.data
      const serverMsg = Array.isArray(body?.message)
        ? body.message.join(". ")
        : body?.message

      if (status === 401) {
        setError("Неверный email или пароль")
      } else if (status === 400 && serverMsg) {
        setError(serverMsg)
      } else if (!axiosError.response) {
        setError(
          `Не удалось связаться с сервером (${axiosError.code ?? "NETWORK"}). ` +
          `Проверь, что backend поднят на ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}.`,
        )
      } else {
        setError(serverMsg || "Ошибка входа. Попробуйте снова")
      }
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo and branding */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <LowCorLogo className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              LowCor
            </h1>
          </div>
          <p className="text-sm tracking-wide text-muted-foreground text-balance text-center uppercase">
            {"Следи за здоровьем. Понимай себя."}
          </p>
        </div>

        {/* Login card */}
        <Card className="border-border bg-card">
          <CardContent className="pt-8 pb-6 px-8">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              {/* Error message */}
              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                  {error}
                </div>
              )}

              {/* Email field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-sm font-medium text-secondary-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={errors.email ? "true" : "false"}
                  className="h-12 rounded-lg border-border bg-input text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                  {...register("email", {
                    required: "Email обязателен",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Введите корректный email",
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-xs text-destructive-foreground" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-sm font-medium text-secondary-foreground">
                  {"Пароль"}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={errors.password ? "true" : "false"}
                    className="h-12 rounded-lg border-border bg-input pr-12 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                    {...register("password", {
                      required: "Пароль обязателен",
                      minLength: {
                        value: 6,
                        message: "Минимум 6 символов",
                      },
                    })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive-foreground" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="mt-2 h-12 w-full rounded-lg text-sm font-bold uppercase tracking-wider"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {"Вход..."}
                  </>
                ) : (
                  <>
                    {"Войти"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-border px-8 py-5">
            <p className="text-sm text-muted-foreground">
              {"Нет аккаунта? "}
              <Link
                href="/register"
                prefetch
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {"Зарегистрироваться"}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
