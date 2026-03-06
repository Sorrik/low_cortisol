"use client"

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Column {
  key: string
  label: string
  render?: (value: unknown, row: any) => React.ReactNode
}

// ─────────────────────────────────────────────────────────────
// Generic версия — теперь можно передавать любой тип записи
// ─────────────────────────────────────────────────────────────
interface HistoryTableProps<T extends { id: string; date: string }> {
  columns: Column[]
  data: T[]
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  isLoading?: boolean
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function HistoryTable<T extends { id: string; date: string }>({
  columns,
  data,
  onEdit,
  onDelete,
  isLoading,
}: HistoryTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-12">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-12">
        <p className="text-sm text-muted-foreground">Нет записей</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Добавьте первую запись с помощью кнопки выше
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Дата</TableHead>
            {columns.map((col) => (
              <TableHead key={col.key} className="text-muted-foreground">
                {col.label}
              </TableHead>
            ))}
            <TableHead className="text-right text-muted-foreground">Действия</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id} className="border-border">
              <TableCell className="text-foreground font-medium">
                {formatDate(row.date)}
              </TableCell>

              {columns.map((col) => (
                <TableCell key={col.key} className="text-foreground">
                  {col.render
                    ? col.render(row[col.key as keyof T], row)
                    : String((row as any)[col.key] ?? "—")}
                </TableCell>
              ))}

              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(row)}
                      aria-label="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive-foreground"
                      onClick={() => onDelete(row)}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}