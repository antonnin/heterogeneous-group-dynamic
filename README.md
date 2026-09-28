# micro:bitada - Generador de Grups Heterogenis

Dinàmica per a fer grups heterogenis per a la **micro:bitada**.

Aplicació web en temps real connectada a Firebase Firestore que permet als participants inscriure's amb el seu nivell d'experiència en micro:bit i genera automàticament equips equilibrats i heterogenis per a les activitats de la micro:bitada.

## Funcionalitats

- **Taulell del Moderador**: Projecció amb codi QR en temps real, comptadors de participants per nivell d'experiència (Novell, Bàsic, Intermedi, Avançat) i generador d'equips heterogenis mitjançant distribució equilibrada en serpentina.
- **Vista del Participant**: Formulari adaptat a dispositius mòbils per triar nom i nivell d'experiència, amb pantalla d'espera i notificació en temps real de l'equip assignat.
- **Gestor de Dades Firebase (Admin)**: Panell protegit amb contrasenya (`GTRoboticaBP2026`) que permet gestionar múltiples sessions, visualitzar tots els participants, filtrar, exportar a CSV i eliminar participants o sessions senceres.
