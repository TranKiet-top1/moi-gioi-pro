import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = 'premise-images'

// true = chỉ kiểm tra, chưa xóa
// false = xóa thật
const DRY_RUN = false

function extractStoragePath(value) {
  if (!value || typeof value !== 'string') return null

  let image = value.trim()
  if (!image) return null

  image = image.split('?')[0]

  const publicMarker = `/storage/v1/object/public/${BUCKET}/`
  const signedMarker = `/storage/v1/object/sign/${BUCKET}/`

  if (image.includes(publicMarker)) {
    return decodeURIComponent(image.split(publicMarker)[1]).replace(/^\/+/, '')
  }

  if (image.includes(signedMarker)) {
    return decodeURIComponent(image.split(signedMarker)[1]).replace(/^\/+/, '')
  }

  if (image.startsWith(`${BUCKET}/`)) {
    return decodeURIComponent(image.slice(BUCKET.length + 1)).replace(/^\/+/, '')
  }

  return decodeURIComponent(image).replace(/^\/+/, '')
}

async function getUsedImagePaths() {
  const usedPaths = new Set()
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('premises')
      .select('id, images')
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    for (const row of data) {
      const images = Array.isArray(row.images) ? row.images : []

      for (const image of images) {
        const path = extractStoragePath(image)
        if (path) usedPaths.add(path)
      }
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  return usedPaths
}

async function listAllStorageFiles(path = '') {
  let allFiles = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(path, {
        limit,
        offset,
        sortBy: { column: 'created_at', order: 'asc' }
      })

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    for (const item of data) {
      const fullPath = path ? `${path}/${item.name}` : item.name

      // folder
      if (!item.id && !item.metadata) {
        const nestedFiles = await listAllStorageFiles(fullPath)
        allFiles = allFiles.concat(nestedFiles)
      } else {
        allFiles.push({
          path: fullPath,
          size: item.metadata?.size || 0,
          created_at: item.created_at
        })
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return allFiles
}

async function main() {
  console.log('Đang lấy danh sách ảnh đang được dùng trong bảng premises...')
  const usedPaths = await getUsedImagePaths()

  console.log(`Số ảnh đang được database dùng: ${usedPaths.size}`)

  console.log('Đang lấy danh sách toàn bộ ảnh trong Storage...')
  const storageFiles = await listAllStorageFiles()

  console.log(`Tổng số file trong Storage: ${storageFiles.length}`)

  const orphanFiles = storageFiles.filter(file => !usedPaths.has(file.path))

  const totalSizeMB = orphanFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024

  console.log(`Số ảnh rác sẽ xóa: ${orphanFiles.length}`)
  console.log(`Dung lượng dự kiến xóa: ${totalSizeMB.toFixed(2)} MB`)

  console.log('Ví dụ 20 ảnh rác đầu tiên:')
  console.table(orphanFiles.slice(0, 20))

  if (DRY_RUN) {
    console.log('DRY_RUN đang bật. Chưa xóa thật.')
    console.log('Nếu kết quả đúng, đổi DRY_RUN = false rồi chạy lại.')
    return
  }

  const batchSize = 100

  for (let i = 0; i < orphanFiles.length; i += batchSize) {
    const batch = orphanFiles.slice(i, i + batchSize).map(file => file.path)

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(batch)

    if (error) {
      console.error('Lỗi xóa batch:', error.message)
    } else {
      console.log(`Đã xóa ${Math.min(i + batch.length, orphanFiles.length)}/${orphanFiles.length} ảnh`)
    }
  }

  console.log('Hoàn tất xóa ảnh rác.')
}

main().catch(error => {
  console.error('Lỗi:', error)
  console.error('Nguyên nhân:', error.cause)
})