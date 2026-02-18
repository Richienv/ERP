"use client"

import { useCategories } from "@/hooks/use-categories"
import { CategoriesClient } from "./client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function CategoriesPage() {
    const { data, isLoading } = useCategories()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-emerald-400" />
    }

    return <CategoriesClient categories={data.categories} allCategories={data.allCategories} />
}
