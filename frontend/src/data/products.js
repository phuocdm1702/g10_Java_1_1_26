export const API_ORIGIN = 'http://localhost:8080'

// Bỏ qua đường dẫn ảnh giả (/images/products/...) trong file seed SQL; giữ nguyên link Cloud (https://...) hoặc ghép localhost cho /uploads/...
export const imgUrl = u => {
    if (!u || typeof u !== 'string') return null
    const trimmed = u.trim()
    if (!trimmed || trimmed.startsWith('/images/products/')) return null
    return /^https?:\/\//i.test(trimmed) ? trimmed : API_ORIGIN + trimmed
}

export const colorsOf = p => [...new Map((p?.bienThe ?? []).map(v => [v.mau.ma, v.mau])).values()]

// Chỉ lấy ảnh riêng của đúng màu đó (không fallback sang ảnh chung) — nếu màu chưa có ảnh sẽ trả về [] để hiển thị áo mẫu SVG theo màu
export const ownImagesFor = (sp, maMau) => {
    if (!maMau) return []
    return (sp?.hinhAnh ?? [])
        .filter(h => h.maMau === maMau)
        .map(h => imgUrl(h.url))
        .filter(Boolean)
}

// Ảnh hiển thị cho thẻ sản phẩm:
// - Khi maMau == null (mặc định): ưu tiên Ảnh chung trước, sau đó đến ảnh các màu
// - Khi đã chọn 1 maMau cụ thể: chỉ lấy ảnh riêng của màu đó (nếu màu đó chưa có ảnh -> trả [] để vẽ áo SVG đúng màu đó)
export const imagesFor = (sp, maMau) => {
    const valid = (sp?.hinhAnh ?? [])
        .map(h => ({ ...h, resolvedUrl: imgUrl(h.url) }))
        .filter(h => Boolean(h.resolvedUrl))

    if (maMau == null) {
        const common = valid.filter(h => h.maMau == null).map(h => h.resolvedUrl)
        const others = valid.filter(h => h.maMau != null).map(h => h.resolvedUrl)
        return [...new Set([...common, ...others])]
    }

    return valid.filter(h => h.maMau === maMau).map(h => h.resolvedUrl)
}

// Xây dựng toàn bộ album ảnh kiểu Shopee:
// 1. Ảnh chung đứng đầu
// 2. Tiếp theo là từng màu sắc: màu nào đã có ảnh thật thì hiện các ảnh thật đó; màu nào CHƯA có ảnh riêng thì hiện 1 khung áo mẫu SVG (url: null) theo đúng mã màu Hex đó!
export const buildProductGallery = sp => {
    const colors = colorsOf(sp)
    const defaultHex = colors[0]?.hex ?? '#1f2a44'

    const valid = (sp?.hinhAnh ?? [])
        .map(h => ({ ...h, resolvedUrl: imgUrl(h.url) }))
        .filter(h => Boolean(h.resolvedUrl))

    const gallery = []
    const seen = new Set()

    const pushItem = (url, maMau, tenMau, hex, isSample = false) => {
        const key = `${maMau ?? 'chung'}|${url ?? 'svg-sample'}`
        if (seen.has(key)) return
        seen.add(key)
        gallery.push({ url, maMau: maMau ?? null, tenMau, hex, isSample })
    }

    // 1. Đưa toàn bộ Ảnh chung (maMau == null) lên đầu danh sách
    valid.filter(h => h.maMau == null).forEach(h => {
        pushItem(h.resolvedUrl, null, 'Ảnh chung', defaultHex, false)
    })
// 2
    // 2. Tiếp theo là từng màu của sản phẩm:
    // Nếu màu đó chưa có ảnh thật -> tạo 1 slide áo mẫu SVG (url: null) đúng màu đó (VD: Đỏ đô -> áo SVG màu đỏ đô)
    colors.forEach(c => {
        const colorImgs = valid.filter(h => h.maMau === c.ma)
        if (colorImgs.length > 0) {
            colorImgs.forEach(h => pushItem(h.resolvedUrl, c.ma, c.ten, c.hex, false))
        } else {
            pushItem(null, c.ma, c.ten, c.hex, true)
        }
    })

    return gallery
}

export const vnd = n => Number(n).toLocaleString('vi-VN') + ' ₫'
