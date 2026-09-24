"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  authFetch,
} from "../lib/api";


type Company = {
  company_name?: string;
  name?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  slogan?: string;
};


type Props = {
  company: Company;
  documentTitle: string;
  documentNumber?: string;
  documentDate?: string;
};


const DEFAULT:any = {
  primary_color:"#0B2D5B",
  secondary_color:"#1769AA",
  accent_color:"#E8F1FA",

  font_family:"Arial",
  title_size:28,
  body_size:11,

  logo_size:90,
  logo_position:"left",
  density:"normal",

  logo_url:"",
  company_name_override:"",
  slogan_override:"",
  header_text:"",
  footer_text:"",

  whatsapp:"",
  nif:"",
  rccm:"",

  show_address:true,
  show_phone:true,
  show_email:true,
  show_website:true,
  show_slogan:true,
  show_signature:true,
};


export default function PrintableCompanyHeader({
  company,
  documentTitle,
  documentNumber,
  documentDate,
}:Props) {

  const [templateId,setTemplateId] =
    useState("model1");

  const [config,setConfig] =
    useState<any>(DEFAULT);


  useEffect(()=>{
    let alive=true;

    authFetch("/document-design/current")
      .then(r=>r.json())
      .then(d=>{
        if (!alive) return;

        setTemplateId(
          d?.template_id || "model1"
        );

        setConfig({
          ...DEFAULT,
          ...(d?.config || {}),
        });
      })
      .catch(()=>{});

    return ()=>{
      alive=false;
    };
  },[]);


  useEffect(()=>{

    const body=document.body;

    body.classList.add(
      "document-theme-active"
    );

    body.dataset.documentTemplate =
      templateId;

    body.style.setProperty(
      "--doc-primary",
      config.primary_color
    );

    body.style.setProperty(
      "--doc-secondary",
      config.secondary_color
    );

    body.style.setProperty(
      "--doc-accent",
      config.accent_color
    );

    body.style.setProperty(
      "--doc-font",
      config.font_family
    );

    body.style.setProperty(
      "--doc-body-size",
      `${config.body_size}px`
    );

    return ()=>{
      body.classList.remove(
        "document-theme-active"
      );
    };

  },[
    templateId,
    config.primary_color,
    config.secondary_color,
    config.accent_color,
    config.font_family,
    config.body_size,
  ]);


  const logo =
    config.logo_url ||
    company?.logo_url ||
    "";


  const companyName =
    config.company_name_override ||
    company?.company_name ||
    company?.name ||
    "Entreprise";


  const slogan =
    config.slogan_override ||
    company?.slogan ||
    "";


  const BrandInfo = () => (
    <>
      <div className="doc-brand-main">

        {logo ? (
          <img
            src={logo}
            alt="Logo entreprise"
            className="doc-logo"
            style={{
              width:config.logo_size,
              height:config.logo_size,
            }}
          />
        ) : (
          <div className="doc-logo-placeholder">
            {companyName
              .charAt(0)
              .toUpperCase()}
          </div>
        )}

        <div className="doc-company-text">

          <div className="doc-company-name">
            {companyName}
          </div>

          {config.show_slogan &&
            slogan && (
            <div className="doc-slogan">
              {slogan}
            </div>
          )}

          {config.header_text && (
            <div className="doc-header-extra">
              {config.header_text}
            </div>
          )}

        </div>
      </div>

      <div className="doc-contact-line">

        {config.show_address &&
          company.address && (
          <span>
            {company.address}
          </span>
        )}

        {config.show_phone &&
          company.phone && (
          <span>
            Tél : {company.phone}
          </span>
        )}

        {config.show_email &&
          company.email && (
          <span>
            {company.email}
          </span>
        )}

        {config.show_website &&
          company.website && (
          <span>
            {company.website}
          </span>
        )}

        {config.whatsapp && (
          <span>
            WhatsApp : {config.whatsapp}
          </span>
        )}

        {config.nif && (
          <span>
            NIF : {config.nif}
          </span>
        )}

        {config.rccm && (
          <span>
            RCCM : {config.rccm}
          </span>
        )}

      </div>
    </>
  );


  const Title = () => (
    <div className="doc-title-box">

      <div
        className="doc-document-title"
        style={{
          fontSize:
            config.title_size,
        }}
      >
        {documentTitle}
      </div>

      {documentNumber && (
        <div className="doc-document-number">
          {documentNumber}
        </div>
      )}

      {documentDate && (
        <div className="doc-document-date">
          {documentDate}
        </div>
      )}

    </div>
  );


  return (
    <>
      <header
        className={`document-header document-${templateId}`}
      >

        {/* MODELE 1 — CORPORATE LOGISTICS */}
        {templateId==="model1" && (
          <>
            <div className="m1-topbar" />

            <div className="m1-layout">
              <div>
                <BrandInfo/>
              </div>

              <Title/>
            </div>
          </>
        )}


        {/* MODELE 2 — EXECUTIVE MINIMAL */}
        {templateId==="model2" && (
          <>
            <div className="m2-header">
              <BrandInfo/>

              <div className="m2-rule" />

              <Title/>
            </div>
          </>
        )}


        {/* MODELE 3 — INDUSTRIAL TRANSPORT */}
        {templateId==="model3" && (
          <div className="m3-shell">

            <div className="m3-sidebar">
              <div className="m3-vertical-text">
                DOCUMENT OFFICIEL
              </div>
            </div>

            <div className="m3-content">

              <div className="m3-head-row">
                <BrandInfo/>
                <Title/>
              </div>

            </div>

          </div>
        )}


        {/* MODELE 4 — PREMIUM EXECUTIF */}
        {templateId==="model4" && (
          <>
            <div className="m4-black">
              <BrandInfo/>
              <Title/>
            </div>

            <div className="m4-gold-line" />
          </>
        )}


        {/* MODELE 5 — SIGNATURE MODERNE */}
        {templateId==="model5" && (
          <div className="m5-shell">

            <div className="m5-shape" />

            <div className="m5-content">

              <BrandInfo/>

              <div className="m5-title">
                <Title/>
              </div>

            </div>

          </div>
        )}

      </header>


      <div className="document-print-footer">

        <div>
          {config.footer_text ||
            slogan ||
            "Merci pour votre confiance."}
        </div>

        <strong>
          {companyName}
        </strong>

      </div>


      <style jsx global>{`

        /*
        ====================================================
        BASE COMMUNE
        ====================================================
        */

        body.document-theme-active {
          --doc-primary:
            ${config.primary_color};

          --doc-secondary:
            ${config.secondary_color};

          --doc-accent:
            ${config.accent_color};

          --doc-font:
            ${config.font_family};

          --doc-body-size:
            ${config.body_size}px;
        }


        body.document-theme-active main,
        body.document-theme-active .doc-sheet,
        body.document-theme-active .document-sheet {
          font-family:
            var(--doc-font),
            sans-serif !important;

          font-size:
            var(--doc-body-size);
        }


        .document-header {
          margin-bottom:22px;
          font-family:
            var(--doc-font),
            sans-serif;
          color:#111827;
        }


        .doc-brand-main {
          display:flex;
          align-items:flex-start;
          gap:14px;
        }


        .doc-logo {
          flex:none;
          object-fit:contain;
        }


        .doc-logo-placeholder {
          width:70px;
          height:70px;
          display:flex;
          align-items:center;
          justify-content:center;
          border:2px solid currentColor;
          font-size:28px;
          font-weight:900;
        }


        .doc-company-name {
          font-size:20px;
          font-weight:950;
          line-height:1.05;
          text-transform:uppercase;
        }


        .doc-slogan {
          margin-top:4px;
          font-size:12px;
          font-weight:700;
          opacity:.75;
        }


        .doc-header-extra {
          white-space:pre-line;
          margin-top:5px;
          font-size:11px;
          opacity:.75;
        }


        .doc-contact-line {
          display:flex;
          flex-wrap:wrap;
          gap:3px 14px;
          margin-top:8px;
          font-size:10px;
          line-height:1.35;
        }


        .doc-title-box {
          min-width:210px;
        }


        .doc-document-title {
          font-weight:950;
          text-transform:uppercase;
          letter-spacing:.02em;
          line-height:1;
        }


        .doc-document-number {
          margin-top:7px;
          font-size:12px;
          font-weight:900;
        }


        .doc-document-date {
          margin-top:3px;
          font-size:10px;
        }


        /*
        ====================================================
        MODELE 1 — CORPORATE LOGISTICS
        bleu / couleur société
        ====================================================
        */

        .document-model1 {
          border-bottom:
            3px solid
            var(--doc-primary);
        }


        .m1-topbar {
          height:11px;
          margin-bottom:14px;
          background:
            var(--doc-primary);
        }


        .m1-layout {
          display:grid;
          grid-template-columns:
            1fr auto;
          gap:24px;
          align-items:start;
          padding-bottom:14px;
        }


        .document-model1
        .doc-company-name {
          color:
            var(--doc-primary);
        }


        .document-model1
        .doc-title-box {
          padding:13px 16px;
          background:
            var(--doc-primary);
          color:#fff;
          text-align:right;
        }


        /*
        ====================================================
        MODELE 2 — EXECUTIVE MINIMAL
        noir blanc très sobre
        ====================================================
        */

        .document-model2 {
          color:#111;
        }


        .m2-header {
          text-align:center;
        }


        .m2-header
        .doc-brand-main {
          flex-direction:column;
          align-items:center;
          justify-content:center;
        }


        .m2-header
        .doc-contact-line {
          justify-content:center;
        }


        .m2-header
        .doc-company-name {
          font-family:
            Georgia,
            serif;
          letter-spacing:.08em;
        }


        .m2-rule {
          width:90px;
          height:1px;
          background:#111;
          margin:17px auto;
        }


        .m2-header
        .doc-title-box {
          margin:auto;
          text-align:center;
        }


        .m2-header
        .doc-document-title {
          font-family:
            Georgia,
            serif;
          font-weight:500;
          letter-spacing:.14em;
        }


        /*
        ====================================================
        MODELE 3 — INDUSTRIAL TRANSPORT
        bande verticale technique
        ====================================================
        */

        .m3-shell {
          display:grid;
          grid-template-columns:
            44px 1fr;
          border:
            1px solid
            var(--doc-primary);
          background:#fff;
        }


        .m3-sidebar {
          min-height:150px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:
            var(--doc-primary);
          color:#fff;
          overflow:hidden;
        }


        .m3-vertical-text {
          transform:
            rotate(-90deg);
          white-space:nowrap;
          font-size:9px;
          font-weight:900;
          letter-spacing:.22em;
        }


        .m3-content {
          padding:15px 17px;
          background:
            linear-gradient(
              90deg,
              var(--doc-accent)
              0,
              #fff 38%
            );
        }


        .m3-head-row {
          display:grid;
          grid-template-columns:
            1fr auto;
          gap:20px;
        }


        .m3-content
        .doc-company-name {
          color:
            var(--doc-primary);
        }


        .m3-content
        .doc-title-box {
          border-left:
            5px solid
            var(--doc-secondary);
          padding-left:13px;
          text-align:right;
        }


        .m3-content
        .doc-document-title {
          color:
            var(--doc-primary);
        }


        /*
        ====================================================
        MODELE 4 — PREMIUM EXECUTIF
        noir + secondaire or/beige
        ====================================================
        */

        .m4-black {
          display:grid;
          grid-template-columns:
            1fr auto;
          gap:24px;
          background:#111;
          color:#fff;
          padding:19px;
        }


        .m4-black
        .doc-company-name {
          color:#fff;
          font-family:
            Georgia,
            serif;
        }


        .m4-black
        .doc-title-box {
          text-align:right;
        }


        .m4-black
        .doc-document-title {
          font-family:
            Georgia,
            serif;
          color:
            var(--doc-secondary);
        }


        .m4-gold-line {
          height:5px;
          background:
            var(--doc-secondary);
        }


        /*
        ====================================================
        MODELE 5 — SIGNATURE MODERNE
        géométrique / asymétrique
        ====================================================
        */

        .m5-shell {
          position:relative;
          min-height:155px;
          overflow:hidden;
          border-bottom:
            5px solid
            var(--doc-primary);
          background:#fff;
        }


        .m5-shape {
          position:absolute;
          top:0;
          right:-60px;
          width:330px;
          height:100%;
          background:
            var(--doc-primary);
          transform:
            skewX(-20deg);
          transform-origin:top;
        }


        .m5-content {
          position:relative;
          z-index:2;
          display:grid;
          grid-template-columns:
            1fr 300px;
          gap:30px;
          padding:18px 25px;
        }


        .m5-content
        .doc-company-name {
          color:
            var(--doc-primary);
        }


        .m5-title {
          color:#fff;
          text-align:right;
          padding-top:8px;
        }


        .m5-title
        .doc-title-box {
          color:#fff;
        }


        /*
        ====================================================
        TABLEAUX
        ====================================================
        */

        body.document-theme-active
        table {
          border-collapse:
            collapse;
        }


        body.document-theme-active
        table thead tr {
          background:
            var(--doc-primary)
            !important;
          color:#fff
            !important;
        }


        body[data-document-template="model2"]
        table thead tr {
          background:#fff
            !important;
          color:#111
            !important;
          border-top:
            2px solid #111;
          border-bottom:
            2px solid #111;
        }


        body[data-document-template="model3"]
        table thead tr {
          background:
            #273444
            !important;
          color:#fff
            !important;
        }


        body[data-document-template="model4"]
        table thead tr {
          background:#111
            !important;
          color:
            var(--doc-secondary)
            !important;
        }


        body[data-document-template="model5"]
        table thead tr {
          background:
            var(--doc-primary)
            !important;
          color:#fff
            !important;
        }


        body.document-theme-active
        table tbody tr:nth-child(even) {
          background:
            var(--doc-accent);
        }


        body[data-document-template="model2"]
        table tbody tr:nth-child(even) {
          background:#fff;
        }


        /*
        ====================================================
        SIGNATURES
        ====================================================
        */

        body.document-theme-active
        .signature-zone {
          break-inside:avoid;
          page-break-inside:avoid;
        }


        body[data-document-template="model1"]
        .signature-zone > div {
          border-top:
            3px solid
            var(--doc-primary);
          padding-top:8px;
        }


        body[data-document-template="model2"]
        .signature-zone > div {
          border-top:
            1px solid #111;
          padding-top:8px;
        }


        body[data-document-template="model3"]
        .signature-zone > div {
          border-left:
            5px solid
            var(--doc-primary);
          padding-left:10px;
        }


        body[data-document-template="model4"]
        .signature-zone > div {
          border-top:
            3px solid
            var(--doc-secondary);
          padding-top:8px;
        }


        body[data-document-template="model5"]
        .signature-zone > div {
          border-top:
            4px solid
            var(--doc-primary);
          padding-top:8px;
        }


        /*
        ====================================================
        FOOTER
        ====================================================
        */

        .document-print-footer {
          display:none;
        }


        @media print {

          @page {
            size:A4;
            margin:12mm;
          }


          body {
            background:#fff;
          }


          .document-print-footer {
            display:flex;
            position:fixed;
            bottom:5mm;
            left:10mm;
            right:10mm;

            justify-content:
              space-between;
            gap:20px;

            padding-top:4mm;

            border-top:
              1px solid
              var(--doc-secondary);

            font-size:8px;
            color:#555;

            font-family:
              var(--doc-font),
              sans-serif;
          }

        }

      `}</style>

    </>
  );
}
