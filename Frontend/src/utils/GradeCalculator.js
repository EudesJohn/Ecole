/**
 * GradeCalculator - Unified for Secondary, Primary and Maternelle
 * Cycle-specific logic: Weighted Averages for Secondary, Validation Ratio for Primary/Maternelle.
 */
const GradeCalculator = {
  // --- SECONDARY SYSTEM ---
  // Formula: (((Moyenne_Interros + DW) / 2) + D1 + D2) / 3
  calculateSubjectAverage: (interro1, interro2, interro3, dw, d1, d2) => {
    const i1 = parseFloat(interro1) || 0;
    const i2 = parseFloat(interro2) || 0;
    const i3 = parseFloat(interro3) || 0;
    const v_dw = parseFloat(dw) || 0;
    const v_d1 = parseFloat(d1) || 0;
    const v_d2 = parseFloat(d2) || 0;

    // We check if any grades are entered. If all are 0/empty, return 0.
    const allValid = [interro1, interro2, interro3, dw, d1, d2].some(v => !isNaN(parseFloat(v)));
    if (!allValid) return 0;

    // 1. Calculate Interros Average
    const validInterros = [interro1, interro2, interro3].filter(v => !isNaN(parseFloat(v)));
    const moyInterro = validInterros.length > 0 
      ? validInterros.reduce((a, b) => a + parseFloat(b), 0) / validInterros.length 
      : 0;

    // 2. Strict Secondary Formula
    // (((Moy_Interros + DW)/2) + D1 + D2) / 3
    const intermediate = (moyInterro + v_dw) / 2;
    const total = (intermediate + v_d1 + v_d2) / 3;

    return Math.round(total * 100) / 100;
  },

  // --- BENINESE PRIMARY SYSTEM (Legacy CM/CP) ---
  calculateStepGrade: (noteCM, noteCP) => {
    const cm = parseFloat(noteCM) || 0;
    const cp = parseFloat(noteCP) || 0;
    const total = cm + cp;
    return Math.min(20, Math.max(0, Math.round(total * 100) / 100));
  },

  // --- UNIFIED HELPERS ---
  getMoyenneByCycle: (g, cycle) => {
    if (!g) return 0;
    // For Primary and Maternelle, we average the compositions (interro1, interro2, interro3)
    if (cycle === 'primaire' || cycle === 'maternelle') {
      const compositions = [g.interro1, g.interro2, g.interro3].filter(v => v !== null && v !== undefined && v !== '');
      if (compositions.length > 0) {
        return compositions.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / compositions.length;
      }
      return parseFloat(g.composition) || 0;
    }
    // For Secondary, we use the weighted average
    return GradeCalculator.calculateSubjectAverage(g.interro1, g.interro2, g.interro3, g.dw, g.d1, g.d2);
  },

  /**
   * Calculates how many subjects have a grade >= 10
   */
  calculateValidatedCount: (subjectGrades, cycle) => {
    if (!Array.isArray(subjectGrades)) return 0;
    return subjectGrades.filter(g => {
      const moy = GradeCalculator.getMoyenneByCycle(g, cycle);
      return moy >= 10;
    }).length;
  },

  calculateMoyennePondere: (moyennes, coefficients) => {
    if (!moyennes || moyennes.length === 0) return 0;
    let totalPoints = 0;
    let totalCoeffs = 0;
    for (let i = 0; i < moyennes.length; i++) {
      const m = parseFloat(moyennes[i]) || 0;
      const c = parseFloat(coefficients[i]) || 1;
      totalPoints += m * c;
      totalCoeffs += c;
    }
    return totalCoeffs > 0 ? Math.round((totalPoints / totalCoeffs) * 100) / 100 : 0;
  },

  getAppreciation: (moy) => {
    if (moy >= 18) return 'Excellent';
    if (moy >= 16) return 'Très Bien';
    if (moy >= 14) return 'Bien';
    if (moy >= 12) return 'Assez Bien';
    if (moy >= 10) return 'Passable';
    return 'Insuffisant';
  }
};

export default GradeCalculator;
