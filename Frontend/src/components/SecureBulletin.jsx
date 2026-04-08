import {
  Document, Page, View, Text, StyleSheet, Image
} from '@react-pdf/renderer';
import GradeCalculator from '../utils/GradeCalculator';

// Using standard PDF fonts (built-in, no download required)
// This eliminates "Offset outside bounds" and "403 Forbidden" errors.
const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';


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




const SecureBulletin = ({ student, gradesBySubject, matieres, classStats, qrCodeDataUrl, trimestre = '1er', schoolYear = '2025-2026' }) => {
  

  
  // Calculate per-subject averages — Absolute type safety
  const safeGradesBySubject = Array.isArray(gradesBySubject) ? gradesBySubject : [];
  const safeMatieres = Array.isArray(matieres) ? matieres : [];

  

  const rows = safeGradesBySubject.map(g => {
    const matInfo = safeMatieres.find(m => (m.nom === g.matiere || m.id === g.matiere_id)) || {};
    const coeff = matInfo.coefficient || 1;
    const category = matInfo.category || 'ECRITE';
    
    const moy = GradeCalculator.getMoyenneByCycle(g, student.cycle);
    const points = moy * coeff;
    const appreciation = GradeCalculator.getAppreciation(moy);
    
    return { 
      ...g, 
      coeff, 
      category, 
      moyenne: moy, 
      points, 
      appreciation,
      moyenneEtape: GradeCalculator.calculateStepGrade(g.note_cm, g.note_cp)
    };
  });

  const isPrimaryData = ['primaire', 'maternelle'].includes(student.cycle?.toLowerCase());

  // Group by category for primary
  const categories = {
    'ORALE': rows.filter(r => r.category === 'ORALE'),
    'ECRITE': rows.filter(r => r.category === 'ECRITE'),
    'PRATIQUE': rows.filter(r => r.category === 'PRATIQUE'),
  };

  // Calculate overall weighted average
  const safeRows = rows.filter(r => r.moyenne !== null);
  const totalPoints = safeRows.reduce((acc, r) => acc + (r.moyenne * r.coeff), 0);
  const totalCoeffs = safeRows.reduce((acc, r) => acc + r.coeff, 0);
  const maxPoints = totalCoeffs * 20;
  
  const moyenneGenerale = GradeCalculator.calculateMoyennePondere(
    safeRows.map(r => r.moyenne),
    safeRows.map(r => r.coeff)
  );
  
  const subjectsSuccess = safeRows.filter(r => r.moyenne >= 10).length;
  const totalSubjects = safeRows.length;
  const validationRatio = `${subjectsSuccess} / ${totalSubjects}`;
  const appreciation = GradeCalculator.getAppreciation(moyenneGenerale);
  const periodTitle = isPrimaryData && props.periodLabel && !props.periodLabel.toLowerCase().startsWith('trimestre')
    ? `Composition de ${props.periodLabel}`
    : `${trimestre} Trimestre`;

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
            <Text style={styles.infoValue}>{student.dateNaissance || '01/01/2000'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Matricule</Text>
            <Text style={styles.infoValue}>{student.matricule}</Text>
            <Text style={styles.infoLabel}>Classe</Text>
            <Text style={styles.infoValue}>{student.classe || 'Indéfinie'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Sexe / Effectif</Text>
            <Text style={styles.infoValue}>{student.sexe || '—'} / {classStats?.effectif || '—'} élèves</Text>
            <Text style={styles.infoLabel}>Période</Text>
            <Text style={styles.infoValue}>{trimestre} Trimestre</Text>
          </View>
        </View>

        {/* Grades Table - Dynamic by Cycle */}
        {isPrimaryData ? (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '30%', textAlign: 'left' }]}>Matières</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>C1</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>C2</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>C3</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Etap</Text>
              <Text style={[styles.tableHeaderCell, { width: '5%' }]}>Coef</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Moy</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Appréciation</Text>
            </View>
            
            {Object.entries(categories).map(([cat, catRows]) => (
              catRows.length > 0 && (
                <View key={cat}>
                  <View style={{ backgroundColor: '#f1f5f9', padding: 4, borderBottom: '0.5pt solid #e2e8f0' }}>
                    <Text style={{ fontSize: 7, fontFamily: FONT_BOLD, color: '#475569' }}>BLOC : {cat}</Text>
                  </View>
                  {catRows.map((row, i) => {
                    const comps = Array.isArray(row.compositions) && row.compositions.length > 0 
                      ? row.compositions 
                      : [row.interro1, row.interro2, row.interro3];
                    
                    return (
                      <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                        <Text style={[styles.tableCell, { width: '30%', textAlign: 'left', fontFamily: FONT_BOLD }]}>{row.matiere}</Text>
                        <Text style={[styles.tableCell, { width: '10%' }]}>{comps[0] || '—'}</Text>
                        <Text style={[styles.tableCell, { width: '10%' }]}>{comps[1] || '—'}</Text>
                        <Text style={[styles.tableCell, { width: '10%' }]}>{comps[2] || '—'}</Text>
                        <Text style={[styles.tableCell, { width: '10%', fontSize: 7 }]}>
                          {row.note_cm || row.note_cp ? GradeCalculator.calculateStepGrade(row.note_cm, row.note_cp).toFixed(2) : '—'}
                        </Text>
                        <Text style={[styles.tableCell, { width: '5%' }]}>{row.coeff}</Text>
                        <Text style={[styles.tableCellBold, { width: '10%', color: row.moyenne < 10 ? '#ef4444' : '#1e3a8a' }]}>
                          {row.moyenne.toFixed(2)}
                        </Text>
                        <Text style={[styles.tableCell, { width: '15%', fontSize: 6 }]}>{row.appreciation}</Text>
                      </View>
                    );
                  })}
                </View>
              )
            ))}
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'left' }]}>Matière</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>I1</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>I2</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>I3</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>DW</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>D1</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>D2</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>Coef</Text>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>Moy</Text>
              <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Appréciation</Text>
            </View>
            {rows.map((row, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.tableCell, { width: '20%', textAlign: 'left', fontFamily: FONT_BOLD }]}>{row.matiere}</Text>
                <Text style={[styles.tableCell, { width: '8%' }]}>{row.interro1 || '—'}</Text>
                <Text style={[styles.tableCell, { width: '8%' }]}>{row.interro2 || '—'}</Text>
                <Text style={[styles.tableCell, { width: '8%' }]}>{row.interro3 || '—'}</Text>
                <Text style={[styles.tableCell, { width: '8%' }]}>{row.dw || '—'}</Text>
                <Text style={[styles.tableCell, { width: '8%' }]}>{row.d1 || '—'}</Text>
                <Text style={[styles.tableCell, { width: '8%' }]}>{row.d2 || '—'}</Text>
                <Text style={[styles.tableCellBold, { width: '8%', color: '#1e3a8a' }]}>{row.coeff}</Text>
                <Text style={[styles.tableCellBold, { width: '8%', color: row.moyenne < 10 ? '#ef4444' : '#1e3a8a' }]}>
                  {row.moyenne.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, { width: '16%', fontSize: 7 }]}>{row.appreciation}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Attitudes & Success Section - Primary only */}
        {isPrimaryData && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
            <View style={{ flex: 2, padding: 10, border: '1pt solid #e2e8f0', borderRadius: 4 }}>
               <Text style={{ fontSize: 7, color: '#64748b', marginBottom: 5, fontFamily: FONT_BOLD }}>ATTITUDES & CONDUITE</Text>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 7 }}>Assiduité / Ponctualité :</Text>
                  <Text style={{ fontSize: 7, fontFamily: FONT_BOLD }}>Tr&egrave;s Bonne</Text>
               </View>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 7 }}>Discipline / Tenue :</Text>
                  <Text style={{ fontSize: 7, fontFamily: FONT_BOLD }}>Exemplaire</Text>
               </View>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 7 }}>Travail / Effort :</Text>
                  <Text style={{ fontSize: 7, fontFamily: FONT_BOLD }}>S&eacute;rieux</Text>
               </View>
            </View>
            <View style={{ flex: 1, padding: 10, backgroundColor: '#f0f9ff', border: '1pt solid #bae6fd', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ fontSize: 7, color: '#0369a1', marginBottom: 2 }}>RÉCAPITULATION</Text>
               <Text style={{ fontSize: 16, fontFamily: FONT_BOLD, color: '#0369a1' }}>{subjectsSuccess} / {totalSubjects}</Text>
               <Text style={{ fontSize: 6, color: '#0369a1' }}>Mati&egrave;res Valid&eacute;es</Text>
            </View>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryBox}>
          {isPrimaryData ? (
            <View style={[styles.summaryCard, { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]}>
              <Text style={[styles.summaryLabel, { color: '#166534' }]}>Matières Validées</Text>
              <Text style={[styles.summaryValue, { color: '#166534', fontSize: 18 }]}>
                {validationRatio}
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.summaryCard, { borderColor: '#1e3a8a' }]}>
                <Text style={styles.summaryLabel}>Points Totaux</Text>
                <Text style={[styles.summaryValue, { color: '#1e3a8a', fontSize: 12 }]}>
                  {totalPoints.toFixed(2)} / {maxPoints}
                </Text>
              </View>
              <View style={[styles.summaryCard, { borderColor: '#1e3a8a' }]}>
                <Text style={styles.summaryLabel}>Moyenne Générale</Text>
                <Text style={[styles.summaryValue, { color: moyenneGenerale < 10 ? '#ef4444' : '#1e3a8a' }]}>
                  {moyenneGenerale.toFixed(2)}/20
                </Text>
              </View>
            </>
          )}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Rang</Text>
            <Text style={styles.summaryValue}>{classStats.rang}{classStats.rang == 1 ? 'er' : 'ème'}</Text>
          </View>
          {!isPrimaryData && (
            <>
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
            </>
          )}
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
            <Text style={styles.footerText}>Bulletin généré par le système SLB</Text>
            <Text style={styles.footerText}>Réf: {student.matricule} • {trimestre} Trim. • {schoolYear}</Text>
            <Text style={[styles.footerText, { color: '#1e3a8a', fontFamily: FONT_BOLD }]}>Vérifier sur : saintlambert.bj/verify/{student.matricule}/{trimestre.replace(/[^0-9]/g, '')}/{schoolYear}</Text>
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
