"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { AxiosError } from "axios"
import Link from "next/link"
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react"

import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { LowCorLogo } from "@/components/lowcor-logo"

interface RegisterFormValues {
  firstName: string
  lastName: string
  email: string
  password: string
  dateOfBirth: string
}

export function RegisterForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      dateOfBirth: "",
    },
  })

  async function onSubmit(data: RegisterFormValues) {
    setError(null)
    try {
      await api.post("/auth/register", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
      })

      // Auto-login after successful registration
      const loginResponse = await api.post("/auth/login", {
        email: data.email,
        password: data.password,
      })
      localStorage.setItem("access_token", loginResponse.data.access_token)
      localStorage.setItem("user", JSON.stringify(loginResponse.data.user))
      router.push("/onboarding")
    } catch (err) {
      const axiosError = err as AxiosError
      if (axiosError.response?.status === 409) {
        setError("Пользователь с таким email уже существует")
      } else {
        setError("Ошибка регистрации. Попробуйте снова")
      }
    }
  }

  const inputClasses =
    "h-12 rounded-lg border-border bg-input text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"

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

        {/* Register card */}
        <Card className="border-border bg-card">
          <CardContent className="pt-8 pb-6 px-8">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              {/* Error message */}
              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                  {error}
                </div>
              )}

              {/* Name row */}
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-secondary-foreground">
                    {"Имя"}
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Иван"
                    autoComplete="given-name"
                    aria-invalid={errors.firstName ? "true" : "false"}
                    className={inputClasses}
                    {...register("firstName", {
                      required: "Имя обязательно",
                    })}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive-foreground" role="alert">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-secondary-foreground">
                    {"Фамилия"}
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Иванов"
                    autoComplete="family-name"
                    aria-invalid={errors.lastName ? "true" : "false"}
                    className={inputClasses}
                    {...register("lastName", {
                      required: "Фамилия обязательна",
                    })}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive-foreground" role="alert">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

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
                  className={inputClasses}
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
                    placeholder="Минимум 6 символов"
                    autoComplete="new-password"
                    aria-invalid={errors.password ? "true" : "false"}
                    className={`${inputClasses} pr-12`}
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

              {/* Date of birth field (optional) */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="dateOfBirth" className="text-sm font-medium text-secondary-foreground">
                  {"Дата рождения"}
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    {"(необязательно)"}
                  </span>
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  autoComplete="bday"
                  className={`${inputClasses} [color-scheme:dark]`}
                  {...register("dateOfBirth")}
                />
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
                    {"Регистрация..."}
                  </>
                ) : (
                  <>
                    {"Зарегистрироваться"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-border px-8 py-5">
            <p className="text-sm text-muted-foreground">
              {"Уже есть аккаунт? "}
              <Link
                href="/login"
                prefetch
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {"Войти"}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
