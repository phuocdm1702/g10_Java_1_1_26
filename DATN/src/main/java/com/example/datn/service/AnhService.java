package com.example.datn.service;

import com.example.datn.dto.AnhResponse;
import com.example.datn.entity.Anh;
import com.example.datn.entity.MauSac;
import com.example.datn.entity.SanPham;
import com.example.datn.entity.SanPhamChiTiet;
import com.example.datn.repository.AnhRepository;
import com.example.datn.repository.MauSacRepository;
import com.example.datn.repository.SanPhamChiTietRepository;
import com.example.datn.repository.SanPhamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Dịch vụ nghiệp vụ quản lý Hình ảnh sản phẩm (phân nhóm theo màu, giới hạn số lượng, chọn ảnh chính và đồng bộ biến thể).
 * Phần lưu trữ vật lý được ủy quyền cho {@link CloudinaryStorageService}.
 */
@Service
@RequiredArgsConstructor
public class AnhService {
    private static final int MAX_PER_GROUP = 8;
    private static final String DEFAULT_PLACEHOLDER = "/images/products/default-placeholder.png";
    private static final String SEED_PLACEHOLDER_PREFIX = "/images/products/";

    private final AnhRepository anhRepo;
    private final SanPhamRepository spRepo;
    private final MauSacRepository mauRepo;
    private final SanPhamChiTietRepository spctRepo;
    private final CloudinaryStorageService storageService;

    @Transactional(readOnly = true)
    public List<AnhResponse> list(Integer idAo) {
        return findRealProductImages(idAo).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AnhResponse upload(Integer idAo, Integer idMau, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Chưa chọn file ảnh");
        }
        SanPham sp = spRepo.findById(idAo)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm"));
        MauSac mau = idMau == null ? null
                : mauRepo.findById(idMau).orElseThrow(() -> new RuntimeException("Màu không tồn tại"));

        cleanupDummyPlaceholders(idAo);

        List<Anh> group = sameGroup(idAo, idMau);
        if (group.size() >= MAX_PER_GROUP) {
            throw new RuntimeException("Mỗi màu tối đa " + MAX_PER_GROUP + " ảnh");
        }

        byte[] bytes = readBytes(file);
        String ext = storageService.detectImageExtension(bytes);
        if (ext == null) {
            throw new RuntimeException("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");
        }

        String uploadedUrl = storageService.uploadImage(bytes, ext);

        Anh anh = new Anh();
        anh.setSanPham(sp);
        anh.setMauSac(mau);
        anh.setAnhUrl(uploadedUrl);
        anh.setMoTa("");
        anh.setThuTu(nextOrderIndex(group));
        anh.setTrangThai(true);
        Anh saved = anhRepo.saveAndFlush(anh);

        syncVariantImages(idAo);
        return toResponse(saved);
    }

    @Transactional
    public void setPrimary(Integer id) {
        Anh chosen = anhRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ảnh"));
        Integer idAo = chosen.getSanPham().getId();
        Integer idMau = chosen.getMauSac() == null ? null : chosen.getMauSac().getId();

        List<Anh> group = sameGroup(idAo, idMau);
        List<Anh> ordered = new ArrayList<>(group.size());
        group.stream().filter(a -> a.getId().equals(id)).findFirst().ifPresent(ordered::add);
        group.stream().filter(a -> !a.getId().equals(id)).forEach(ordered::add);

        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).setThuTu(i);
        }
        anhRepo.saveAllAndFlush(ordered);

        syncVariantImages(idAo);
    }

    @Transactional
    public void delete(Integer id) {
        Anh anh = anhRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ảnh"));
        Integer idAo = anh.getSanPham().getId();
        String url = anh.getAnhUrl();

        anhRepo.delete(anh);
        anhRepo.flush();

        storageService.deleteImage(url);
        syncVariantImages(idAo);
    }

    // ---------------------------------------------------------------
    // Các phương thức hỗ trợ nghiệp vụ (Domain Helpers)
    // ---------------------------------------------------------------

    private void syncVariantImages(Integer idAo) {
        List<Anh> productImages = findRealProductImages(idAo);
        List<SanPhamChiTiet> variants = spctRepo.findAllByProductId(idAo);
        if (variants.isEmpty()) return;

        String commonPrimary = productImages.stream()
                .filter(img -> img.getMauSac() == null)
                .map(Anh::getAnhUrl)
                .findFirst()
                .orElse(DEFAULT_PLACEHOLDER);

        for (SanPhamChiTiet variant : variants) {
            Integer mauId = variant.getMauSac() == null ? null : variant.getMauSac().getId();
            String primaryForColor = productImages.stream()
                    .filter(img -> img.getMauSac() != null && Objects.equals(img.getMauSac().getId(), mauId))
                    .map(Anh::getAnhUrl)
                    .findFirst()
                    .orElse(commonPrimary);
            variant.setAnhUrl(primaryForColor);
        }
        spctRepo.saveAll(variants);
    }

    private void cleanupDummyPlaceholders(Integer idAo) {
        List<Anh> dummies = anhRepo.findByProduct(idAo).stream()
                .filter(a -> isDummyPlaceholder(a.getAnhUrl()))
                .toList();
        if (!dummies.isEmpty()) {
            anhRepo.deleteAll(dummies);
            anhRepo.flush();
        }
    }

    private List<Anh> findRealProductImages(Integer idAo) {
        return anhRepo.findByProduct(idAo).stream()
                .filter(a -> !isDummyPlaceholder(a.getAnhUrl()))
                .toList();
    }

    private List<Anh> sameGroup(Integer idAo, Integer idMau) {
        return findRealProductImages(idAo).stream()
                .filter(a -> Objects.equals(a.getMauSac() == null ? null : a.getMauSac().getId(), idMau))
                .toList();
    }

    private int nextOrderIndex(List<Anh> group) {
        return group.stream()
                .mapToInt(x -> x.getThuTu() == null ? 0 : x.getThuTu())
                .max()
                .orElse(-1) + 1;
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Không đọc được file ảnh");
        }
    }

    private boolean isDummyPlaceholder(String url) {
        return url == null || url.isBlank() || url.startsWith(SEED_PLACEHOLDER_PREFIX);
    }

    private AnhResponse toResponse(Anh a) {
        return new AnhResponse(
                a.getId(),
                a.getMauSac() == null ? null : a.getMauSac().getId(),
                a.getAnhUrl(),
                a.getThuTu()
        );
    }
}
