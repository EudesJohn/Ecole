const GradeCalculator = {
  // Calculate subject average
  // Primary: depends on compositions
  // Secondary: (((Avg(Interros) + DW) / 2) + D1 + D2) / 3
  calculateSubjectAverage: (interro1, interro2, interro3, dw, d1, d2, isPrimary = false) => {
    if (isPrimary) return 0; // Handled by calculatePrimaryAverage

    const interros = [
      parseFloat(interro1),
      parseFloat(interro2),
      parseFloat(interro3)
    ].filter(v => !isNaN(v));

    const moyInterro = interros.length > 0 
      ? interros.reduce((sum, v) => sum + v, 0) / interros.length 
      : 0;

    const valDw = parseFloat(dw) || 0;
    const valD1 = parseFloat(d1) || 0;
    const valD2 = parseFloat(d2) || 0;

    // Formula: (((MoyInterro + DW) / 2) + D1 + D2) / 3
    const interroPart = (moyInterro + valDw) / 2;
    const total = interroPart + valD1 + valD2;
    
    return Math.round((total / 3) * 100) / 100;
  },

  // Calculate Primary average (Maternel to CM2)
  // Simple average of n compositions
  calculatePrimaryAverage: (comps) => {
    const validComps = (comps || []).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (validComps.length === 0) return 0;
    const sum = validComps.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / validComps.length) * 100) / 100;
  },

  // Calculate Annual Average: (T1 + T2 + T3) / 3
  calculateAnnualAverage: (t1, t2, t3) => {
    const v1 = parseFloat(t1) || 0;
    const v2 = parseFloat(t2) || 0;
    const v3 = parseFloat(t3) || 0;

    // Simple average for secondary
    return Math.round(((v1 + v2 + v3) / 3) * 100) / 100;
  },

  // Calculate weighted overall average (moyenne pondérée)
  calculateMoyennePondere: (moyennes, coefficients) => {
    if (!moyennes.length || moyennes.length !== coefficients.length) return 0;
    const total = moyennes.reduce((sum, moy, i) => sum + (moy * (parseFloat(coefficients[i]) || 1)), 0);
    const totalCoeff = coefficients.reduce((sum, coeff) => sum + (parseFloat(coeff) || 1), 0);
    return totalCoeff > 0 ? Math.round((total / totalCoeff) * 100) / 100 : 0;
  },

  // Calculate student rank in class
  calculateRang: (eleveMoy, classeMoyennes) => {
    if (!classeMoyennes || classeMoyennes.length === 0) return '—';
    const sorted = [...classeMoyennes].sort((a, b) => b - a);
    const rank = sorted.findIndex(m => Math.abs(m - eleveMoy) < 0.01) + 1;
    return rank || classeMoyennes.length;
  },

  // Auto-appreciation based on average
  getAppreciation: (moy) => {
    if (moy >= 18) return 'Excellent — Félicitations du Conseil !';
    if (moy >= 16) return 'Très Bien — Félicitations';
    if (moy >= 14) return 'Bien — Tableau d\'honneur';
    if (moy >= 12) return 'Assez Bien — Encouragements';
    if (moy >= 10) return 'Passable';
    if (moy >= 8) return 'Insuffisant — Efforts à fournir';
    return 'Très Insuffisant — Avertissement de travail';
  },

  // Check if alert needed (note < 10)
  needsAlert: (moy) => moy < 10,

  // Calculate class statistics from all student averages
  calculateClassStats: (allStudentMoyennes) => {
    if (!allStudentMoyennes || allStudentMoyennes.length === 0) {
      return { moyenneClasse: 0, plusForte: 0, plusFaible: 0, effectif: 0, allMoyennes: [] };
    }
    const sorted = [...allStudentMoyennes].sort((a, b) => b - a);
    const sum = sorted.reduce((acc, m) => acc + m, 0);
    return {
      moyenneClasse: Math.round((sum / sorted.length) * 100) / 100,
      plusForte: sorted[0],
      plusFaible: sorted[sorted.length - 1],
      effectif: sorted.length,
      allMoyennes: sorted,
    };
  },
};

export default GradeCalculator;
