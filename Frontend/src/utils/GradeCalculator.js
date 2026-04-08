/**
 * GradeCalculator - Unified for Secondary, Primary and Maternelle
 * Cycle-specific logic: Weighted Averages for Secondary, Validation Ratio for Primary/Maternelle.
 */
const GradeCalculator = {
  // --- SECONDARY SYSTEM ---
  calculateSubjectAverage: (interro1, interro2, interro3, dw, d1, d2) => {
    const i1 = parseFloat(interro1);
    const i2 = parseFloat(interro2);
    const i3 = parseFloat(interro3);
    const v_dw = parseFloat(dw);
    const v_d1 = parseFloat(d1);
    const v_d2 = parseFloat(d2);

    const validInterros = [i1, i2, i3].filter(v => !isNaN(v));
    if (validInterros.length === 0 && isNaN(v_dw) && isNaN(v_d1) && isNaN(v_d2)) return 0;

    const moyInterro = validInterros.length > 0 
      ? validInterros.reduce((a, b) => a + b, 0) / validInterros.length 
      : 0;

    const part1 = !isNaN(v_dw) ? (moyInterro + v_dw) / 2 : moyInterro;
    const part2 = !isNaN(v_d1) ? v_d1 : 0;
    const part3 = !isNaN(v_d2) ? v_d2 : 0;

    const count = 1 + (!isNaN(v_d1) ? 1 : 0) + (!isNaN(v_d2) ? 1 : 0);
    const result = (part1 + part2 + part3) / count;

    return Math.round(result * 100) / 100;
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
    // For Primary and Maternelle, we now use a SINGLE NOTE (composition field)
    if (cycle === 'primaire' || cycle === 'maternelle') {
      return parseFloat(g.composition) || 0;
    }
    // For Secondary, we use the weighted average of interros and homeworks
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
