"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.replace("/login")
    }
  }, [router])

  return (
    <div className="min-h-svh bg-background">
      <DashboardSidebar />
      <main className="lg:pl-64">
        <div className="min-h-svh pb-20 lg:pb-0">
          {children}
        </div>
      </main>
    </div>
  )
}
