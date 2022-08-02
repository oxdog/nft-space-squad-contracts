import * as fs from 'fs'
import path from 'path'

export const saveDataToFile = (data: any, filename: string) => {
  fs.writeFileSync(
    path.join(__dirname, `../../data/${filename}`),
    JSON.stringify(data)
  )
}
