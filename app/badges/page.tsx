"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  QRCodeCanvas,
} from "qrcode.react";


type UserRow = {
  id: number;
  fullname?: string;
  role?: string;
  phone?: string;
  badge_code?: string;
  profile_image_url?: string;
  company_id?: number;
  is_active?: boolean;
};


const LOGO =
  "/brands/triangle-official.jpeg";


function badgeCode(
  user: UserRow
) {
  return (
    user.badge_code ||
    `TRIANGLE-EMP-${user.id}`
  );
}


function qrValue(
  user: UserRow
) {
  return JSON.stringify({
    badge_code:
      badgeCode(user),
  });
}


function roleLabel(
  role?: string
) {
  return String(
    role || "Employé"
  )
    .replace(/_/g, " ")
    .trim()
    .toUpperCase();
}


function escapeHtml(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


export default function BadgesPage() {

  const [
    users,
    setUsers,
  ] =
    useState<UserRow[]>([]);


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    canViewBadges,
    setCanViewBadges,
  ] =
    useState(false);


  const [
    selected,
    setSelected,
  ] =
    useState<
      Set<number>
    >(
      new Set()
    );


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    showPhotos,
    setShowPhotos,
  ] =
    useState(true);


  async function fetchUsers() {

    const stored =
      localStorage.getItem(
        "user"
      );


    const currentUser =
      stored
        ? JSON.parse(
            stored
          )
        : null;


    const role =
      String(
        currentUser?.role ||
        ""
      ).toLowerCase();


    const allowed =
      currentUser?.is_super_admin ===
        true ||
      role ===
        "super_admin" ||
      role ===
        "admin";


    if (!allowed) {

      setCanViewBadges(
        false
      );


      setError(
        "Accès refusé : les badges sont réservés à l’administrateur."
      );

      return;
    }


    setCanViewBadges(
      true
    );


    const response =
      await fetch(
        "/api/users",

        {
          headers: {
            Authorization:
              `Bearer ${localStorage.getItem(
                "token"
              )}`,
          },
        }
      );


    const data =
      await response
        .json()
        .catch(
          () => []
        );


    if (!response.ok) {

      setError(
        data.error ||
        "Erreur chargement badges."
      );

      return;
    }


    setUsers(
      Array.isArray(
        data
      )
        ? data
        : []
    );
  }


  useEffect(() => {
    fetchUsers();
  }, []);


  const filtered =
    useMemo(
      () => {

        const q =
          search
            .trim()
            .toLowerCase();


        if (!q) {
          return users;
        }


        return users.filter(
          (user) => {

            const text = [
              user.fullname,
              user.role,
              user.phone,
              user.badge_code,
            ]
              .join(" ")
              .toLowerCase();


            return text.includes(
              q
            );
          }
        );
      },

      [
        users,
        search,
      ]
    );


  function toggleUser(
    id: number
  ) {

    setSelected(
      (previous) => {

        const next =
          new Set(
            previous
          );


        if (
          next.has(id)
        ) {
          next.delete(id);
        } else {
          next.add(id);
        }


        return next;
      }
    );
  }


  function selectAll() {

    setSelected(
      new Set(
        filtered.map(
          (user) =>
            user.id
        )
      )
    );
  }


  function clearSelection() {

    setSelected(
      new Set()
    );
  }


  function qrImage(
    user: UserRow
  ) {

    const canvas =
      document.getElementById(
        `badge-qr-${user.id}`
      ) as
        HTMLCanvasElement |
        null;


    return (
      canvas?.toDataURL(
        "image/png"
      ) || ""
    );
  }


  function frontHtml(
    user: UserRow,
    withPhoto: boolean
  ) {

    const photo =
      withPhoto &&
      user.profile_image_url

        ? `
          <img
            class="employee-photo"
            src="${escapeHtml(
              user.profile_image_url
            )}"
            alt=""
          />
        `

        : `
          <div class="employee-photo photo-empty">

            <div class="silhouette">
              👤
            </div>

            <div class="photo-text">
              PHOTO
            </div>

          </div>
        `;


    return `
<section class="page">

  <div class="badge front">

    <div class="yellow-top">

      <div class="slot">
      </div>

    </div>


    <div class="front-content">

      <img
        src="${LOGO}"
        class="logo-front"
        alt="Triangle"
      />


      <div class="photo-frame">

        ${photo}

      </div>

    </div>


    <div class="name-strip">

      ${escapeHtml(
        user.fullname ||
        "EMPLOYÉ"
      )}

    </div>


    <div class="job">

      ${escapeHtml(
        roleLabel(
          user.role
        )
      )}

    </div>


    <div class="gold-line">

      <span></span>

    </div>


    <div class="yellow-bottom">
    </div>

  </div>

</section>
    `;
  }


  function backHtml(
    user: UserRow
  ) {

    const qr =
      qrImage(user);


    const code =
      badgeCode(user);


    return `
<section class="page">

  <div class="badge back">

    <div class="yellow-top">

      <div class="slot">
      </div>

    </div>


    <div class="back-header">

      <img
        src="${LOGO}"
        class="logo-back"
        alt="Triangle"
      />


      <div class="header-line">

        <span></span>

      </div>

    </div>


    <div class="qr-wrapper">

      <div class="qr-frame">

        ${
          qr
            ? `
              <img
                class="qr"
                src="${qr}"
                alt="QR Pointage"
              />
            `
            : ""
        }

      </div>

    </div>


    <div class="badge-number">

      ${escapeHtml(
        code
      )}

    </div>


    <div class="attendance-title">

      BADGE DE POINTAGE

    </div>


    <div class="attendance-help">

      Scanner pour pointage

    </div>


    <div class="employee-info">

      <div class="info-row">

        <div class="info-icon">
          👤
        </div>

        <div>

          <div class="info-label">
            Nom & Prénom
          </div>

          <div class="info-value">
            ${escapeHtml(
              user.fullname ||
              "—"
            )}
          </div>

        </div>

      </div>


      <div class="info-row">

        <div class="info-icon">
          💼
        </div>

        <div>

          <div class="info-label">
            Fonction
          </div>

          <div class="info-value">
            ${escapeHtml(
              roleLabel(
                user.role
              )
            )}
          </div>

        </div>

      </div>


      <div class="info-row">

        <div class="info-icon">
          ☎
        </div>

        <div>

          <div class="info-label">
            Téléphone personnel
          </div>

          <div class="info-value">
            ${escapeHtml(
              user.phone ||
              "—"
            )}
          </div>

        </div>

      </div>


      <div class="info-row no-border">

        <div class="info-icon">
          🏢
        </div>

        <div>

          <div class="info-label">
            Entreprise
          </div>

          <div class="info-company">
            TRIANGLE LOGISTICS TRANSPORT & INTERIM SARL
          </div>

        </div>

      </div>

    </div>


    <div class="lost-box">

      <div class="lost-icon">
        i
      </div>


      <div class="lost-separator">
      </div>


      <div>

        <div class="lost-title">
          EN CAS DE PERTE
        </div>

        <div class="lost-content">

          Merci de contacter :
          <strong>
            70 04 44 04
          </strong>

        </div>

        <div class="lost-small">
          Numéro de l'entreprise
        </div>

      </div>

    </div>


    <div class="yellow-footer">
    </div>

  </div>

</section>
    `;
  }


  function printBadges(
    list: UserRow[],
    withPhoto: boolean,
    onlyBack = false
  ) {

    if (!list.length) {

      alert(
        "Sélectionnez au moins une personne."
      );

      return;
    }


    const popup =
      window.open(
        "",
        "_blank",
        "width=1000,height=900"
      );


    if (!popup) {

      alert(
        "Autorisez les fenêtres contextuelles pour imprimer."
      );

      return;
    }


    const faces: string[] = [];

    for (const user of list) {
      if (onlyBack) {
        faces.push(
          backHtml(user)
        );
      } else {
        faces.push(
          frontHtml(
            user,
            withPhoto
          )
        );

        faces.push(
          backHtml(user)
        );
      }
    }

    const perSheet = 9;

    const sheets: string[] = [];

    for (
      let index = 0;
      index < faces.length;
      index += perSheet
    ) {
      sheets.push(
        `<div class="print-sheet">${
          faces
            .slice(
              index,
              index + perSheet
            )
            .join("")
        }</div>`
      );
    }

    const content =
      sheets.join("");


    popup.document.write(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<title>
Badges Triangle
</title>


<style>

* {
  box-sizing:
    border-box;
}


html,
body {
  margin:
    0;

  padding:
    0;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  background:
    white;

  -webkit-print-color-adjust:
    exact !important;

  print-color-adjust:
    exact !important;
}


@page {
  size: A4 portrait;
  margin: 8mm;
}

.print-sheet {
  width: 194mm;
  min-height: 281mm;
  display: grid;
  grid-template-columns: repeat(3, 54mm);
  grid-auto-rows: 85mm;
  gap: 4mm 8mm;
  align-content: start;
  justify-content: center;
  page-break-after: always;
  break-after: page;
}

.page {
  width: 54mm;
  height: 85mm;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
}


.badge {

  position:
    relative;

  width:
    54mm;

  height:
    85mm;

  background:
    white;

  overflow:
    hidden;

  color:
    #111;
}


.yellow-top {

  position:
    relative;

  height:
    8mm;

  background:
    #f5b000;

  border-radius:
    3mm 3mm 0 0;

  clip-path:
    polygon(
      0 0,
      100% 0,
      100% 100%,
      92% 72%,
      8% 72%,
      0 100%
    );
}


.slot {

  position:
    absolute;

  left:
    50%;

  top:
    2mm;

  transform:
    translateX(-50%);

  width:
    15mm;

  height:
    3.2mm;

  border-radius:
    4mm;

  background:
    white;
}


/* RECTO */

.front-content {

  height:
    56mm;

  display:
    flex;

  flex-direction:
    column;

  align-items:
    center;
}


.logo-front {

  width:
    37mm;

  height:
    18mm;

  object-fit:
    contain;

  margin-top:
    1.5mm;
}


.photo-frame {

  width:
    30mm;

  height:
    34mm;

  margin-top:
    .5mm;

  border:
    .55mm solid
    #f5b000;

  border-radius:
    4mm;

  overflow:
    hidden;

  background:
    #f2f2f2;
}


.employee-photo {

  width:
    100%;

  height:
    100%;

  object-fit:
    cover;

  object-position:
    center top;
}


.photo-empty {

  display:
    flex;

  flex-direction:
    column;

  justify-content:
    center;

  align-items:
    center;

  color:
    #999;
}


.silhouette {

  font-size:
    13mm;
}


.photo-text {

  margin-top:
    1mm;

  font-size:
    2.4mm;

  font-weight:
    800;
}


.name-strip {

  height:
    9mm;

  background:
    #050505;

  color:
    white;

  display:
    flex;

  justify-content:
    center;

  align-items:
    center;

  text-align:
    center;

  padding:
    1mm 2mm;

  font-size:
    4.7mm;

  line-height:
    1;

  font-weight:
    900;

  text-transform:
    uppercase;
}


.job {

  height:
    7mm;

  display:
    flex;

  justify-content:
    center;

  align-items:
    center;

  color:
    #f5a700;

  font-size:
    3.6mm;

  font-weight:
    900;

  text-transform:
    uppercase;
}


.gold-line {

  position:
    relative;

  width:
    40mm;

  height:
    .5mm;

  margin:
    0 auto;

  background:
    #f5b000;
}


.gold-line span {

  position:
    absolute;

  width:
    5mm;

  height:
    1mm;

  left:
    50%;

  top:
    -.25mm;

  transform:
    translateX(-50%);

  border-radius:
    1mm;

  background:
    #f5b000;
}


.yellow-bottom {

  position:
    absolute;

  left:
    0;

  right:
    0;

  bottom:
    0;

  height:
    2.5mm;

  background:
    #f5b000;
}


/* VERSO */

.back-header {

  text-align:
    center;

  height:
    17mm;
}


.logo-back {

  width:
    31mm;

  height:
    14mm;

  object-fit:
    contain;

  margin-top:
    1mm;
}


.header-line {

  position:
    relative;

  width:
    43mm;

  height:
    .4mm;

  background:
    #f5b000;

  margin:
    0 auto;
}


.header-line span {

  position:
    absolute;

  width:
    5mm;

  height:
    1mm;

  left:
    50%;

  top:
    -.3mm;

  transform:
    translateX(-50%);

  background:
    #f5b000;

  border-radius:
    1mm;
}


.qr-wrapper {

  display:
    flex;

  justify-content:
    center;

  margin-top:
    1.5mm;
}


.qr-frame {

  width:
    27mm;

  height:
    27mm;

  padding:
    1mm;

  border:
    .6mm solid
    #f5b000;

  border-radius:
    3mm;

  background:
    white;
}


.qr {

  width:
    100%;

  height:
    100%;

  object-fit:
    contain;
}


.badge-number {

  margin-top:
    1.1mm;

  text-align:
    center;

  font-size:
    2.7mm;

  font-weight:
    900;
}


.attendance-title {

  margin-top:
    .5mm;

  text-align:
    center;

  color:
    #f5a700;

  font-size:
    3mm;

  font-weight:
    900;
}


.attendance-help {

  text-align:
    center;

  font-size:
    2mm;

  margin-top:
    .2mm;
}


.employee-info {

  width:
    46mm;

  margin:
    1.5mm auto 0;

  padding:
    1mm 2mm;

  border:
    .25mm solid
    #ddd;

  border-radius:
    2mm;

  background:
    #fafafa;
}


.info-row {

  min-height:
    5.3mm;

  display:
    flex;

  align-items:
    center;

  gap:
    1.5mm;

  border-bottom:
    .2mm solid
    #ddd;

  padding:
    .7mm 0;
}


.no-border {

  border-bottom:
    none;
}


.info-icon {

  width:
    5mm;

  flex:
    0 0 auto;

  text-align:
    center;

  font-size:
    3.6mm;
}


.info-label {

  color:
    #555;

  font-size:
    1.7mm;
}


.info-value {

  font-size:
    2.2mm;

  font-weight:
    900;

  text-transform:
    uppercase;
}


.info-company {

  font-size:
    1.7mm;

  font-weight:
    900;

  line-height:
    1.12;
}


.lost-box {

  position:
    absolute;

  left:
    4mm;

  right:
    4mm;

  bottom:
    4mm;

  min-height:
    9mm;

  border:
    .5mm solid
    #f5b000;

  border-radius:
    3mm;

  display:
    flex;

  align-items:
    center;

  padding:
    1mm 1.5mm;

  gap:
    1.5mm;

  background:
    white;
}


.lost-icon {

  width:
    6mm;

  height:
    6mm;

  border-radius:
    50%;

  background:
    #111;

  color:
    white;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  font-size:
    3.5mm;

  font-weight:
    900;
}


.lost-separator {

  width:
    .2mm;

  height:
    6mm;

  background:
    #bbb;
}


.lost-title {

  color:
    #f5a700;

  font-size:
    2.2mm;

  font-weight:
    900;
}


.lost-content {

  font-size:
    1.7mm;

  margin-top:
    .3mm;
}


.lost-content strong {

  margin-left:
    .5mm;

  font-size:
    2.2mm;
}


.lost-small {

  font-size:
    1.4mm;

  margin-top:
    .2mm;
}


.yellow-footer {

  position:
    absolute;

  left:
    0;

  right:
    0;

  bottom:
    0;

  height:
    2.5mm;

  background:
    #f5b000;
}


@media screen {

  body {
    background: #eee;
    padding: 20px;
  }

  .print-sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 20px;
    padding: 8mm;
    background: white;
    box-shadow:
      0 3px 18px
      rgba(
        0,
        0,
        0,
        .20
      );
  }

  .page {
    box-shadow:
      0 1px 6px
      rgba(
        0,
        0,
        0,
        .18
      );
  }

}


@media print {

  html,
  body {
    width: 210mm;
    min-height: 297mm;
  }

  body {
    margin: 0;
    padding: 0;
    background: white;
  }

  .print-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }

}

</style>

</head>


<body>

${content}


<script>

window.onload =
function () {

  setTimeout(
    function () {
      window.print();
    },
    500
  );

};

</script>

</body>

</html>
    `);


    popup.document.close();
  }


  function printOne(
    user: UserRow
  ) {

    printBadges(
      [user],
      showPhotos,
      false
    );
  }


  function printWithoutPhoto(
    user: UserRow
  ) {

    printBadges(
      [user],
      false,
      false
    );
  }


  function printBackOnly(
    user: UserRow
  ) {

    printBadges(
      [user],
      false,
      true
    );
  }


  function printSelected() {

    const list =
      users.filter(
        (user) =>
          selected.has(
            user.id
          )
      );


    printBadges(
      list,
      showPhotos,
      false
    );
  }


  return (

    <main
      className="
        min-h-screen
        bg-slate-100
        p-4
        md:p-6
      "
    >

      <div
        className="
          mx-auto
          max-w-7xl
        "
      >


        <div
          className="
            mb-6
            flex
            flex-wrap
            items-start
            justify-between
            gap-4
          "
        >

          <div>

            <h1
              className="
                text-3xl
                font-black
              "
            >

              Badges Triangle

            </h1>


            <p
              className="
                mt-1
                text-slate-500
              "
            >

              Format 54 × 85 mm — recto professionnel et grand QR de pointage au verso.

            </p>

          </div>


          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >

            <button
              type="button"

              onClick={
                selectAll
              }

              className="
                rounded-xl
                border
                bg-white
                px-4
                py-3
                font-bold
              "
            >

              Tout sélectionner

            </button>


            <button
              type="button"

              onClick={
                clearSelection
              }

              className="
                rounded-xl
                border
                bg-white
                px-4
                py-3
                font-bold
              "
            >

              Désélectionner

            </button>


            <button
              type="button"

              disabled={
                !selected.size
              }

              onClick={
                printSelected
              }

              className="
                rounded-xl
                bg-yellow-500
                px-4
                py-3
                font-black
                disabled:opacity-40
              "
            >

              Imprimer sélection
              {" "}
              ({selected.size})

            </button>

          </div>

        </div>


        {error && (

          <div
            className="
              mb-5
              rounded-xl
              bg-red-100
              p-4
              font-bold
              text-red-700
            "
          >

            {error}

          </div>
        )}


        {!canViewBadges
          ? null
          : (

            <>

              <section
                className="
                  mb-5
                  grid
                  gap-3
                  rounded-2xl
                  bg-white
                  p-4
                  shadow-sm
                  md:grid-cols-[1fr_auto]
                "
              >

                <input
                  value={
                    search
                  }

                  onChange={
                    (event) =>
                      setSearch(
                        event.target.value
                      )
                  }

                  placeholder="
                    Rechercher un employé…
                  "

                  className="
                    rounded-xl
                    border
                    p-3
                  "
                />


                <label
                  className="
                    flex
                    cursor-pointer
                    items-center
                    gap-3
                    rounded-xl
                    bg-slate-100
                    px-4
                    py-3
                    font-bold
                  "
                >

                  <input
                    type="checkbox"

                    checked={
                      showPhotos
                    }

                    onChange={
                      (event) =>
                        setShowPhotos(
                          event.target.checked
                        )
                    }

                    className="
                      h-5
                      w-5
                    "
                  />

                  Imprimer avec photo

                </label>

              </section>


              <div
                className="
                  grid
                  gap-5
                  md:grid-cols-2
                  xl:grid-cols-3
                "
              >

                {filtered.map(
                  (user) => {

                    const checked =
                      selected.has(
                        user.id
                      );


                    return (

                      <article
                        key={
                          user.id
                        }

                        className="
                          rounded-2xl
                          bg-white
                          p-5
                          shadow-sm
                        "
                      >


                        <label
                          className="
                            flex
                            cursor-pointer
                            items-center
                            gap-3
                          "
                        >

                          <input
                            type="checkbox"

                            checked={
                              checked
                            }

                            onChange={
                              () =>
                                toggleUser(
                                  user.id
                                )
                            }

                            className="
                              h-5
                              w-5
                            "
                          />

                          <span
                            className="
                              font-black
                            "
                          >

                            {user.fullname}

                          </span>

                        </label>


                        <div
                          className="
                            mt-4
                            text-sm
                            text-slate-500
                          "
                        >

                          {roleLabel(
                            user.role
                          )}

                          <br/>

                          {badgeCode(
                            user
                          )}

                        </div>


                        <div
                          className="
                            mt-5
                            flex
                            justify-center
                          "
                        >

                          <QRCodeCanvas
                            id={
                              `badge-qr-${user.id}`
                            }

                            value={
                              qrValue(
                                user
                              )
                            }

                            size={
                              220
                            }

                            includeMargin
                          />

                        </div>


                        <div
                          className="
                            mt-5
                            grid
                            gap-2
                          "
                        >

                          <button
                            type="button"

                            onClick={
                              () =>
                                printOne(
                                  user
                                )
                            }

                            className="
                              rounded-xl
                              bg-black
                              px-4
                              py-3
                              font-black
                              text-white
                            "
                          >

                            Imprimer recto / verso

                          </button>


                          <button
                            type="button"

                            onClick={
                              () =>
                                printWithoutPhoto(
                                  user
                                )
                            }

                            className="
                              rounded-xl
                              bg-yellow-500
                              px-4
                              py-3
                              font-black
                            "
                          >

                            Imprimer sans photo

                          </button>


                          <button
                            type="button"

                            onClick={
                              () =>
                                printBackOnly(
                                  user
                                )
                            }

                            className="
                              rounded-xl
                              border
                              px-4
                              py-3
                              font-bold
                            "
                          >

                            Imprimer verso QR uniquement

                          </button>

                        </div>

                      </article>
                    );
                  }
                )}

              </div>

            </>
          )}

      </div>

    </main>
  );
}
