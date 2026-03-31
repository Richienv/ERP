"use client"

import * as React from "react"

interface ModulePageLayoutProps {
  header: React.ReactNode
  agingBar?: React.ReactNode
  approvalBanner?: React.ReactNode
  summaryCards?: React.ReactNode
  statusTabs?: React.ReactNode
  searchBar?: React.ReactNode
  historySection?: React.ReactNode
  children: React.ReactNode
  bottomTabs?: React.ReactNode
  bottomAction?: React.ReactNode
}

export function ModulePageLayout({
  header,
  agingBar,
  approvalBanner,
  summaryCards,
  statusTabs,
  searchBar,
  historySection,
  children,
  bottomTabs,
  bottomAction,
}: ModulePageLayoutProps) {
  return (
    <div className="space-y-4">
      {header}
      {agingBar}
      {approvalBanner}
      {summaryCards}
      {statusTabs}
      {searchBar}
      {historySection}
      {children}
      {bottomTabs}
      {bottomAction && (
        <div className="border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
          {bottomAction}
        </div>
      )}
    </div>
  )
}
