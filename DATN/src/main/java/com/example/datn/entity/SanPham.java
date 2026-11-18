package com.example.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "San_pham")
@Getter @Setter
public class SanPham {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ma_ao")
    private String maAo;

    @Column(name = "ten_ao")
    private String tenAo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_thuong_hieu", referencedColumnName = "id")
    private ThuongHieu thuongHieu;

    @Column(name = "mo_ta")
    private String moTa = "";

    @Column(name = "trang_thai")
    private Boolean trangThai = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_danh_muc", referencedColumnName = "id")
    private DanhMuc danhMuc;

    @Column(name = "doi_tuong")
    private String doiTuong = "Nam";

    @Column(name = "mua")
    private String mua = "Cả năm";

    @Column(name = "kieu_dang")
    private String kieuDang = "Regular";

    @Column(name ="kieu_co")
    private String kieuCo;

    @Column(name ="kieu_tay")
    private String kieuTay;

    @Column(name ="kieu_ong")
    private String kieuong;

    @Column(name ="do_dai_quan")
    private String doDaiQuan;

    @Column(name ="loai_cap")
    private String loaiCap;

}
