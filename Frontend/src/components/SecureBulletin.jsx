import {
  Document, Page, View, Text, StyleSheet, Font, Image, pdf
} from '@react-pdf/renderer';
import GradeCalculator from '../utils/GradeCalculator';

// Using standard PDF fonts (built-in, no download required)
// This eliminates "Offset outside bounds" and "403 Forbidden" errors.
const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: FONT_REGULAR,
    fontSize: 9,
    color: '#1e293b',
    position: 'relative',
  },
  watermark: {
    position: 'absolute',
    top: '35%',
    left: '10%',
    fontSize: 54,
    color: '#1e3a8a',
    opacity: 0.04,
    transform: 'rotate(-35deg)',
    fontFamily: FONT_BOLD,
    letterSpacing: 8,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2pt solid #1e3a8a',
    paddingBottom: 10,
    marginBottom: 15,
  },
  headerLeft: {
    flex: 1,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  schoolName: {
    fontSize: 16,
    fontFamily: FONT_BOLD,
    color: '#1e3a8a',
    textAlign: 'center',
  },
  schoolSubtitle: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  bulletinTitle: {
    fontSize: 13,
    fontFamily: FONT_BOLD,
    color: '#1e3a8a',
    textAlign: 'center',
    marginTop: 6,
    paddingTop: 4,
    borderTop: '1pt solid #d4af37',
  },
  // Student info
  studentInfo: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    border: '1pt solid #e2e8f0',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    color: '#94a3b8',
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 9,
    fontFamily: FONT_BOLD,
    color: '#1e293b',
    marginBottom: 4,
  },
  // Table
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontSize: 7,
    fontFamily: FONT_BOLD,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 8,
    textAlign: 'center',
    color: '#334155',
  },
  tableCellBold: {
    fontSize: 8,
    textAlign: 'center',
    color: '#1e293b',
    fontFamily: FONT_BOLD,
  },
  // Summary
  summaryBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    border: '1pt solid #e2e8f0',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 7,
    color: '#94a3b8',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: FONT_BOLD,
    color: '#1e3a8a',
  },
  // Appreciation
  appreciationBox: {
    padding: 10,
    borderRadius: 4,
    border: '1pt solid #d4af37',
    backgroundColor: '#fffbeb',
    marginBottom: 12,
  },
  appreciationLabel: {
    fontSize: 7,
    color: '#92400e',
    marginBottom: 2,
  },
  appreciationText: {
    fontSize: 11,
    fontFamily: FONT_BOLD,
    color: '#92400e',
  },
  // Signatures
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 15,
  },
  signatureBox: {
    width: '30%',
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 7,
    color: '#64748b',
    marginBottom: 20,
  },
  signatureLine: {
    width: '100%',
    borderBottom: '0.5pt solid #94a3b8',
  },
  // Footer / QR
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1pt solid #1e3a8a',
    paddingTop: 8,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: 6,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
});

const colWidths = {
  matiere: '17%',
  interro1: '7%',
  interro2: '7%',
  interro3: '7%',
  devoir: '7%',
  composition: '7%',
  coeff: '5%',
  moyenne: '8%',
  forte: '8%',
  faible: '8%',
  points: '9%',
  appreciation: '10%',
};

const SecureBulletin = ({ student, gradesBySubject, matieres, classStats, qrCodeDataUrl, trimestre = '1er', schoolYear = '2025-2026' }) => {
  const year = new Date().getFullYear();
  const bulletinId = `SLB-${(student.matricule || '').replace(/\s/g, '')}-T${trimestre}-${Date.now()}`;
  
  // Calculate per-subject averages — Absolute type safety
  const safeGradesBySubject = Array.isArray(gradesBySubject) ? gradesBySubject : [];
  const safeMatieres = Array.isArray(matieres) ? matieres : [];

  const rows = safeGradesBySubject.map(g => {
    const coeff = (safeMatieres.find(m => m.nom === g.matiere) || {}).coefficient || 1;
    const moy = GradeCalculator.calculateSubjectAverage(g.interro1, g.interro2, g.interro3, g.devoir, g.composition);
    const points = moy * coeff;
    const appreciation = GradeCalculator.getAppreciation(moy);
    return { ...g, coeff, moyenne: moy, points, appreciation };
  });

  // Calculate overall weighted average
  const moyennes = rows.map(r => r.moyenne);
  const coeffs = rows.map(r => parseFloat(r.coeff));
  const moyenneGenerale = GradeCalculator.calculateMoyennePondere(moyennes, coeffs);
  const rang = classStats?.rang || '—';
  const appreciation = GradeCalculator.getAppreciation(moyenneGenerale);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
        <Text style={styles.watermark}>SAINT LAMBERT</Text>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: 7, color: '#64748b' }}>RÉPUBLIQUE DU BÉNIN</Text>
            <Text style={{ fontSize: 7, color: '#64748b' }}>Minist&egrave;re de l&apos;&Eacute;ducation</Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.schoolName}>ÉCOLE SAINT LAMBERT</Text>
            <Text style={styles.schoolSubtitle}>&Eacute;tablissement d&apos;excellence — B&eacute;nin</Text>
            <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>Tél: +229 XX XX XX XX · contact@saintlambert.bj</Text>
            <Text style={styles.bulletinTitle}>BULLETIN DE NOTES — {trimestre} Trimestre</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 7, color: '#64748b' }}>Année Scolaire</Text>
            <Text style={{ fontSize: 10, fontFamily: FONT_BOLD, color: '#1e3a8a' }}>{schoolYear}</Text>
          </View>
        </View>

        {/* Student Info */}
        <View style={styles.studentInfo}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Nom et Prénoms</Text>
            <Text style={styles.infoValue}>{student.nom} {student.prenom}</Text>
            <Text style={styles.infoLabel}>Date de naissance</Text>
            <Text style={styles.infoValue}>{student.dateNaissance || '—'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Matricule</Text>
            <Text style={styles.infoValue}>{student.matricule}</Text>
            <Text style={styles.infoLabel}>Classe</Text>
            <Text style={styles.infoValue}>{student.classe}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Sexe</Text>
            <Text style={styles.infoValue}>{student.sexe || '—'}</Text>
            <Text style={styles.infoLabel}>Effectif de la classe</Text>
            <Text style={styles.infoValue}>{classStats?.effectif || '—'}</Text>
          </View>
        </View>

        {/* Grades Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: colWidths.matiere, textAlign: 'left' }]}>Matière</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.interro1 }]}>I1</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.interro2 }]}>I2</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.interro3 }]}>I3</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.devoir }]}>Devoir</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.composition }]}>Compo</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.coeff }]}>Coef</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.moyenne }]}>Moy</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.forte, color: '#16a34a' }]}>Forte</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.faible, color: '#dc2626' }]}>Faible</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.points }]}>Points</Text>
            <Text style={[styles.tableHeaderCell, { width: colWidths.appreciation }]}>Appréciation</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.tableCell, { width: colWidths.matiere, textAlign: 'left', fontWeight: 700 }]}>{row.matiere}</Text>
              <Text style={[styles.tableCell, { width: colWidths.interro1 }]}>{row.interro1 || '—'}</Text>
              <Text style={[styles.tableCell, { width: colWidths.interro2 }]}>{row.interro2 || '—'}</Text>
              <Text style={[styles.tableCell, { width: colWidths.interro3 }]}>{row.interro3 || '—'}</Text>
              <Text style={[styles.tableCell, { width: colWidths.devoir }]}>{row.devoir || '—'}</Text>
              <Text style={[styles.tableCell, { width: colWidths.composition }]}>{row.composition || '—'}</Text>
              <Text style={[styles.tableCellBold, { width: colWidths.coeff, color: '#1e3a8a' }]}>{row.coeff}</Text>
              <Text style={[styles.tableCellBold, { width: colWidths.moyenne, color: row.moyenne < 10 ? '#ef4444' : '#1e3a8a' }]}>
                {row.moyenne.toFixed(2)}
              </Text>
              <Text style={[styles.tableCellBold, { width: colWidths.forte, color: '#16a34a' }]}>{(row.max || 0).toFixed(2)}</Text>
              <Text style={[styles.tableCellBold, { width: colWidths.faible, color: '#dc2626' }]}>{(row.min || 0).toFixed(2)}</Text>
              <Text style={[styles.tableCellBold, { width: colWidths.points, color: '#d4af37' }]}>
                {row.points.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { width: colWidths.appreciation, fontSize: 6.5 }]}>{row.appreciation}</Text>
            </View>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryBox}>
          <View style={[styles.summaryCard, { borderColor: '#1e3a8a' }]}>
            <Text style={styles.summaryLabel}>Moyenne Générale</Text>
            <Text style={[styles.summaryValue, { color: moyenneGenerale < 10 ? '#ef4444' : '#1e3a8a' }]}>
              {moyenneGenerale.toFixed(2)}/20
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Rang</Text>
            <Text style={styles.summaryValue}>{classStats.rang}{classStats.rang === 1 ? 'er' : 'ème'}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Plus forte moy.</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a', fontSize: 12 }]}>
              {classStats?.plusForte?.toFixed(2) || '—'}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Plus faible moy.</Text>
            <Text style={[styles.summaryValue, { color: '#ef4444', fontSize: 12 }]}>
              {classStats?.plusFaible?.toFixed(2) || '—'}
            </Text>
          </View>
        </View>

        {/* Appreciation */}
        <View style={styles.appreciationBox}>
          <Text style={styles.appreciationLabel}>APPRÉCIATION DU CONSEIL DE CLASSE</Text>
          <Text style={styles.appreciationText}>{appreciation}</Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Le Professeur Principal</Text>
            <View style={styles.signatureLine}></View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Le Directeur</Text>
            <View style={styles.signatureLine}></View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Le Parent</Text>
            <View style={styles.signatureLine}></View>
          </View>
        </View>

        {/* Footer with QR */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerText}>Bulletin généré automatiquement par le système SLB</Text>
            <Text style={styles.footerText}>ID: {bulletinId}</Text>
            <Text style={[styles.footerText, { color: '#1e3a8a' }]}>saintlambert.bj/verify/{bulletinId}</Text>
          </View>
          <View style={styles.qrContainer}>
            {qrCodeDataUrl && (
              <Image src={qrCodeDataUrl} style={{ width: 60, height: 60 }} />
            )}
            <Text style={styles.qrLabel}>Scanner pour vérifier</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// Exports removed for Fast Refresh compatibility
// They have been moved to ../utils/bulletinTasks.jsx

export default SecureBulletin;
