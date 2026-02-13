export const dynamic = 'force-dynamic'

import { getAllCategories, getCategories } from "@/app/actions/inventory"
import { CategoriesClient } from "./client"

/** Race a promise against a timeout — returns fallback on timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

export default async function CategoriesPage() {
  const [categories, dropdownCategories] = await Promise.all([
    withTimeout(getAllCategories(), 8000, []),
    withTimeout(getCategories(), 5000, [])
  ])

  return <CategoriesClient categories={categories} allCategories={dropdownCategories} />
}
