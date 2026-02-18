import { DetailedMaterialTable } from "./detailed-material-table"

interface MaterialTableWrapperProps {
    data: any[]
}

export function MaterialTableWrapper({ data }: MaterialTableWrapperProps) {
    return <DetailedMaterialTable data={data} />
}
