export const dynamic = 'force-dynamic'

import { getAllCategories, getCategories } from "@/app/actions/inventory"
import { CategoriesClient } from "./client"

export default async function CategoriesPage() {
  const [categories, dropdownCategories] = await Promise.all([
    getAllCategories(),
    getCategories()
  ])

  return <CategoriesClient categories={categories} allCategories={dropdownCategories} />
}