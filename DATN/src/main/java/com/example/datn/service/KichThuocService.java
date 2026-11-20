package com.example.datn.service;

import com.example.datn.entity.KichThuoc;
import com.example.datn.dto.KichThuocRequest;
import com.example.datn.dto.KichThuocResponse;
import com.example.datn.repository.KichThuocRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KichThuocService {
    private final KichThuocRepository repository;

    @Transactional(readOnly = true)
    public List<KichThuocResponse> all() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional
    public KichThuocResponse create(KichThuocRequest input) {
        validate(input);
        if (repository.existsByMaKichThuocIgnoreCase(input.maKichThuoc().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã kích thước đã tồn tại");
        }
        String loai = resolveLoai(input);
        if (repository.existsByLoaiKickThuocIgnoreCaseAndTenKichThuocIgnoreCase(loai, input.tenKichThuoc().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên kích thước đã tồn tại trong loại này");
        }
        KichThuoc item = new KichThuoc();
        apply(item, input);
        return toResponse(repository.save(item));
    }

    @Transactional
    public KichThuocResponse update(Integer id, KichThuocRequest input) {
        validate(input);
        KichThuoc item = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kích thước"));
        if (repository.existsByMaKichThuocIgnoreCaseAndIdNot(input.maKichThuoc().trim(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã kích thước đã tồn tại");
        }
        String loai = resolveLoai(input);
        if (repository.existsByLoaiKickThuocIgnoreCaseAndTenKichThuocIgnoreCaseAndIdNot(loai, input.tenKichThuoc().trim(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên kích thước đã tồn tại trong loại này");
        }
        apply(item, input);
        return toResponse(repository.save(item));
    }

    private void validate(KichThuocRequest input) {
        if (input == null || input.maKichThuoc() == null || input.maKichThuoc().isBlank()
                || input.tenKichThuoc() == null || input.tenKichThuoc().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã và tên kích thước không được trống");
        }
    }

    private void apply(KichThuoc item, KichThuocRequest input) {
        String ten = input.tenKichThuoc().trim();
        if (ten.length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên kích thước tối đa 60 ký tự");
        }
        item.setMaKichThuoc(input.maKichThuoc().trim());
        item.setTenKichThuoc(ten);
        item.setLoaiKickThuoc(resolveLoai(input));
        item.setMoTa(input.moTa() == null ? "" : input.moTa());
        item.setTrangThai(input.trangThai() == null ? true : input.trangThai());
    }

    private static String resolveLoai(KichThuocRequest input) {
        String loai = input.loaiKichThuoc() == null ? "" : input.loaiKichThuoc().trim().toUpperCase();
        if (loai.equals("AO") || loai.equals("QUAN")) return loai;
        String ma = input.maKichThuoc() == null ? "" : input.maKichThuoc().trim().toUpperCase();
        return ma.startsWith("KTQ") ? "QUAN" : "AO";
    }

    private KichThuocResponse toResponse(KichThuoc item) {
        return new KichThuocResponse(
                item.getId(), item.getMaKichThuoc(), item.getTenKichThuoc(),
                item.getLoaiKickThuoc(), item.getMoTa(), item.getTrangThai()
        );
    }
}
