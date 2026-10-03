# Competidores del Proyecto

Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA.

Investigación realizada en agosto 2026. Fuentes: sitios oficiales, SFIA Foundation, comparativas del sector (G2, TestGorilla, HackerRank, iMocha).

---

## 1. Plataformas de evaluación técnica (hiring)

Evalúan habilidades de programación mediante desafíos con corrección automática. Usan **taxonomías propietarias** — sus resultados no se expresan en marcos de competencias estándar.

### 1.1 HackerRank

- **Qué es:** Plataforma líder de evaluación técnica (usada por 25%+ del Fortune 100).
- **Servicios:**
  - Biblioteca de 3.000+ preguntas / 7.500+ desafíos de coding, soporta ~58 lenguajes
  - CodePair: entrevistas live con IDE colaborativo
  - AI Interviewer / AI-driven shortlisting
  - IDE de nueva generación (VS Code-based) con AI assistant habilitado para el candidato; el entrevistador monitorea la interacción candidato-IA en tiempo real
  - Evaluación de habilidades RAG/LLM (desde abril 2025)
  - Proctoring: detección multi-monitor, tab-switch, plagio
- **Modelo de precios:** Starter US$165/mes, Pro US$375/mes, planes enterprise negociables.
- **Limitación para nuestro proyecto:** Taxonomía propietaria; foco algorítmico; orientado solo a contratación, no a formación.

### 1.2 CodeSignal

- **Qué es:** Plataforma de evaluación con tests estandarizados y certificaciones de habilidades (research-backed).
- **Servicios:**
  - Assessments certificados con base científica
  - Cosmo AI: asistente de IA para el candidato
  - Scoring predictivo y feedback al candidato
  - Biblioteca de preguntas con prevención de filtraciones
- **Modelo de precios:** Custom (poco transparente).
- **Limitación:** Taxonomía propia; sin vínculo con marcos internacionales; pricing opaco.

### 1.3 Codility

- **Qué es:** Uno de los players establecidos, enfoque tradicional de code quality.
- **Servicios:**
  - Desafíos de programación con evaluación de calidad de código
  - Code playback para revisión detallada
  - Detección de plagio, proctoring básico, controles por tiempo
  - Integración lenta de IA (menos features que competidores)
- **Limitación:** Integración IA limitada; biblioteca de preguntas más pequeña; sin taxonomía estándar.

### 1.4 TestGorilla

- **Qué es:** Plataforma de screening amplio (técnico + soft skills + cognitivo).
- **Servicios:**
  - Biblioteca de 350+ tests (cognitivo, personalidad, culture add, lenguaje, role-specific, programación)
  - TestGorilla Evaluate para hiring técnico, auto-scoring con IA
  - Marketplace de 2M+ candidatos pre-evaluados
  - Formatos de respuesta: video, file upload, multiple-choice, essay
- **Modelo de precios:** Free (5 tests esenciales), Core US$142/mes, Plus custom. Sistema de créditos (1 crédito = sourcing, 3 = evaluación).
- **Limitación:** Tests de programación menos profundos que HackerRank/CodeSignal; taxonomía propietaria.

### 1.5 iMocha

- **Qué es:** Plataforma de "skills intelligence" con la biblioteca más grande del mercado.
- **Servicios:**
  - 10.000+ tests / 25.000+ skills cubiertas (técnico, funcional, cognitivo, conductual)
  - AI-LogicBox: evaluación de lógica sin sintaxis de código
  - Live Coding Interviews, project-based assessments
  - Competency mapping, benchmarking y upskilling empresarial
  - AI-EnglishPro: evaluación de inglés con NLP (CEFR)
  - Proctoring enterprise (imagen, audio, video, IP, window violation)
- **Limitación:** Interfaz compleja para reclutadores; taxonomía propia (no SFIA); foco enterprise.

### 1.6 Karat

- **Qué es:** Servicio de entrevistas técnicas humanas potenciadas por IA (no self-service).
- **Servicios:**
  - Entrevistas técnicas conducidas por entrevistadores profesionales de Karat
  - NextGen: formato humano + IA para 2026
  - Formato "AI-Ready Engineer Assessments"
- **Limitación:** Es un servicio, no una plataforma que el usuario opera; costo por entrevista; sin taxonomía estándar.

### 1.7 Otras menciones

- **HackerEarth:** AI Interview Agent con avatar video, assessments adaptativos; casos: Amazon (60.000+ devs evaluados), Trimble (pool 30→10 por cargo), GlobalLogic (20 min/candidato).
- **CoderPad:** IDE de entrevistas pair-programming, 50% más rápido.
- **LeetCode:** No es plataforma de hiring formal sino de práctica/benchmark personal; biblioteca enorme de problemas algorítmicos.

---

## 2. Certificadores / evaluadores con marco SFIA

Evalúan y certifican competencias alineadas a SFIA. Todas se basan en **autoevaluación + evidencia retrospectiva + entrevista con assessor acreditado**. Ninguna incorpora evaluación práctica hands-on.

### 2.1 APMG International

- **Qué es:** Ente certificador global (AgilePM, ISO 27001, etc.); primer SFIA Approved Assessment Partner activo (alcance Commercial/Global).
- **Servicios:**
  - Esquema aprobado para que organizaciones ejecuten evaluaciones internas siguiendo procesos documentados
  - Panel de assessores acreditados (SFIA Accredited Assessors) que evalúan individuos
  - Badges digitales vía **Credly** con endorsement de la SFIA Foundation (única plataforma aprobada para badges SFIA)
  - API para que otros partners conecten su portal con Credly
  - Mapeo de certificaciones APMG a skills SFIA (por fee adicional, quien obtiene una cert APMG puede reclamar el badge SFIA asociado)
- **Cómo evalúa:** postulación de hasta 6 skills SFIA → evidencia de experiencia laboral (≥85% de la descripción de la skill en el nivel reclamado) → entrevista/discusión profesional con assessor → badge.
- **Catálogo de badges (3 niveles por skill×nivel):**
  - **Knowledge** — demostrada en entorno controlado/educativo
  - **Skill (Proficiency)** — practicada, aunque sea brevemente o sin accountability total
  - **Competency** — practicada en entorno profesional real con atributos genéricos completos
- **Marco normativo:** ISO/IEC 17024:2012 e ISO/IEC 24773.

### 2.2 SkillsTX

- **Qué es:** Plataforma de skills intelligence (SFIA Global Partner y Training Provider, origen australiano) que combina SaaS + servicios de evaluación. Approved Assessment Partner.
- **Servicios:**
  - **Autoevaluación SFIA gratuita** (individual): genera un "digital skills CV" / radar
  - **Esquema de certificación Category B:** assessores acreditados propios (9+ listados públicamente) certifican Knowledge/Skill/Competency; badges emitidos por APMG vía Credly
  - **SkillsTX Talent eXperience (SaaS):** mapeo de roles a SFIA, gap analysis, planes de sucesión, workforce planning, en Azure Marketplace
  - **TXpertIQ:** agentes de IA embebidos para análisis de skills
  - **CredentialsTX:** plataforma propia de badging (Open Badge 3.0) alineada a SFIA y DigComp, con API de verificación en tiempo real, integración LinkedIn/Credly, emisión batch, white-label, revocación/expiración
  - **Cursos SFIA acreditados** (Foundation, Practitioner, Consultant)
  - Solución directa para estudiantes (skills passport, course validation, job matching)
- **Cómo evalúa:** autoevaluación → solicitud formal (hasta 6 skills) → revisión de evidencia + discusión con assessor → badge. Para Competency exige evidencia de práctica profesional real (85%+ de la descripción SFIA).
- **Caso relevante:** partner Lumify Work reconoce que los tests prácticos "no se miden en SFIA, sino que alimentan a SFIA" — evidencia del gap que nuestro proyecto llena.

### 2.3 ValidateSkills (VSAP / ITSA)

- **Qué es:** Proveedor de plataforma de evaluación (Reino Unido); SFIA Approved Assessment Provider y Global Partner.
- **Servicios:**
  - **VSAP (ValidateSkills Assessment Portal):** plataforma framework-led para assessments alineados a SFIA, CIISec, GCAF y frameworks organizacionales a medida
  - **ITSA (IT Skills Assessment):** portal de tests con tienda online; individuos compran assessments mapeados a roles SFIA (ej. "SFIA aligned Software Developer"); al superar el pass rate se descarga un e-certificado de proficiency
  - **Enfoque evidence-based:** cada juicio de competencia vincula expectativas del rol, inputs del practicante y artefactos de evidencia en un registro auditable (apto para compliance/auditoría)
  - **Reporting en tiempo real:** dashboards de capacidad, gaps y riesgo organizacional
  - **Entrenamiento y consultoría SFIA** (SFIA Approved Trainers): cursos Practitioner, talleres de role mapping e implementación
  - Clientes: British Army Royal Signals, Ricoh, sector público UK
- **Cómo evalúa:** assessments estructurados por rol + captura de evidencia con trazas de auditoría; orientado a workforce planning y ambientes regulados.

### 2.4 BCS SFIAplus

- **Qué es:** Extensión del marco SFIA mantenida por BCS (Chartered Institute for IT, Reino Unido).
- **Servicios:** framework extendido de skills (más granular que SFIA base: SFIA define el "qué", SFIAplus agrega el "cómo"); usado para mapeo de carreras, membresías profesionales y alineación de currículos; no es una plataforma de evaluación práctica.
- **Limitación:** framework de referencia, no herramienta de evaluación hands-on.

---

## 3. El gap que ocupa nuestro proyecto

```
Certificadoras SFIA:  Autoevaluación → Portafolio/evidencia → Entrevista → Badge
                      (certifican experiencia DECLARADA y retrospectiva)

Plataformas hiring:   Coding challenge → Auto-corrección → Score propietario
                      (evalúan práctica REAL pero sin marco estándar)

Nuestro proyecto:     Ejercicios prácticos reales → Corrección automática →
                      Resultados expresados en skills/niveles SFIA
```

Ninguna herramienta existente:
1. Evalúa competencias mediante **ejercicios prácticos** de ingeniería de software (código, system design, debugging) mapeados a skills SFIA
2. Genera contenidos con **modelo híbrido IA + validación experta** estructurado sobre una taxonomía estándar
3. Integra **tutor socrático** alineado a las mismas competencias que evalúa
4. Usa **corrección automática diferenciada por tipo de ejercicio** (tests unitarios / LLM-as-judge con rúbricas)

Fuentes clave: sfia-online.org (Approved Assessment Partners, digital credentials), apmg-international.com, skillstx.com, validateskills.com, bcs.org, hackerrank.com, codesignal.com, codility.com, testgorilla.com, imocha.io, karat.com.

---

## 4. Referencias APA (para el formulario)

- APMG International. (2026). *SFIA Assessments*. https://apmg-international.com/product/sfia-assessments
- BCS. (2026). *SFIAplus - IT skills framework*. https://www.bcs.org/it-careers/sfiaplus-it-skills-framework/
- Burning Glass Institute. (2024). *Hiring Efficiency Study*.
- HackerRank. (2026). *Codility vs HackerRank vs CodeSignal: 2025 Enterprise Comparison*. https://www.hackerrank.com/writing/codility-vs-hackerrank-vs-codesignal-2025-enterprise-comparison
- SFIA Foundation. (2026). *SFIA Approved Assessment Partners*. https://sfia-online.org/en/tools-and-resources/get-help/sfia-approved-assessment-partners
- SkillsTX. (2026). *SFIA Assessment Scheme*. https://skillstx.com/certify/
- TestGorilla. (2024). *TestGorilla vs. HackerRank*. https://www.testgorilla.com/blog/testgorilla-vs-hackerrank
- ValidateSkills. (2026). *Skills Assessment Platform*. https://www.validateskills.com/
