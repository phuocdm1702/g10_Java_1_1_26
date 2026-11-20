package com.example.datn.service;

import com.example.datn.dto.MauSacRequest;
import com.example.datn.entity.MauSac;
import com.example.datn.repository.MauSacRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MauSacService {
    private final MauSacRepository repo;

    public List<MauSac> getAll() { return repo.findAll(); }

    public MauSac getById(Integer id) {
        return repo.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy màu"));
    }

    public MauSac create(MauSacRequest r) {
        if (repo.existsByMaMau(r.maMau())) throw new RuntimeException("Mã màu đã tồn tại");
        MauSac m = new MauSac();
        apply(m, r);
        return repo.save(m);
    }

    public MauSac update(Integer id, MauSacRequest r) {
        if (repo.existsByMaMauAndIdNot(r.maMau(), id)) throw new RuntimeException("Mã màu đã tồn tại");
        MauSac m = getById(id);
        apply(m, r);
        return repo.save(m);
    }

    public void delete(Integer id) { repo.deleteById(id); }

    private void apply(MauSac m, MauSacRequest r) {
        m.setMaMau(r.maMau() == null ? "" : r.maMau().trim());
        m.setTenMau(r.tenMau() == null ? "" : r.tenMau().trim());
        String hex = r.maHex() == null ? "" : r.maHex().trim();
        if (hex.isBlank()) hex = "#000000";
        if (hex.length() > 20) hex = hex.substring(0, 20);
        m.setMaHex(hex);
        m.setMoTa(r.moTa() == null ? "" : r.moTa());
        m.setTrangThai(r.trangThai() != null ? r.trangThai() : true);
    }
}
