import { getMaterialGapAnalysis } from "@/app/actions/inventory"
import { DetailedMaterialTable } from "./detailed-material-table"

export async function MaterialTableWrapper() {
    const materialGapData = await getMaterialGapAnalysis()
    return <DetailedMaterialTable data={materialGapData} />
}
