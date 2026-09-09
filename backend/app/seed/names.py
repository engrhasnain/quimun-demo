"""Name pools for the demo dataset.

Chilean naming conventions throughout: residences are typically named after
trees, saints or Mapudungun words; staff carry two surnames; RUT is the national
tax/ID number formatted 12.345.678-9.
"""

RESIDENCE_NAMES = [
    ("Residencia", "Los Aromos"), ("Hogar", "Santa Teresa"),
    ("Casa de Reposo", "San Rafael"), ("Residencia", "Vista Hermosa"),
    ("Casa de Reposo", "Los Nogales"), ("ELEAM", "El Roble"),
    ("Hogar", "Villa Alegre"), ("Residencia", "Santa Marta"),
    ("Casa de Reposo", "Los Cipreses"), ("Hogar", "Nuestra Señora del Carmen"),
    ("Residencia", "San José"), ("Casa de Reposo", "Las Camelias"),
    ("ELEAM", "El Peumo"), ("Residencia", "Los Robles"),
    ("Hogar", "Santa Elena"), ("Casa de Reposo", "San Francisco"),
    ("Residencia", "Las Araucarias"), ("ELEAM", "Los Maitenes"),
    ("Casa de Reposo", "El Quillay"), ("Hogar", "Santa Rosa"),
    ("Residencia", "Belén"), ("Casa de Reposo", "Aurora"),
    ("ELEAM", "Los Canelos"), ("Residencia", "Rayén"),
    ("Hogar", "Antü"), ("Casa de Reposo", "Millaray"),
    ("ELEAM", "Los Alerces"), ("Residencia", "Puerta del Sol"),
    ("Casa de Reposo", "El Litre"), ("Hogar", "Las Acacias"),
    ("Residencia", "San Andrés"), ("Casa de Reposo", "Santa Clara"),
    ("ELEAM", "Los Boldos"), ("Residencia", "El Espino"),
    ("Hogar", "Las Hortensias"), ("Casa de Reposo", "Los Lingues"),
    ("Residencia", "San Vicente"), ("Hogar", "Santa Ana"),
    ("Casa de Reposo", "El Manzano"), ("ELEAM", "Los Coihues"),
    ("Hogar", "La Merced"), ("Residencia", "Divina Providencia"),
    ("Casa de Reposo", "San Ignacio"), ("Hogar", "Las Rosas"),
    ("Residencia", "El Arrayán"), ("Casa de Reposo", "Los Tilos"),
    ("Hogar", "Santa Filomena"), ("Residencia", "San Camilo"),
    ("ELEAM", "Los Copihues"), ("Casa de Reposo", "El Bosque"),
    ("Hogar", "Las Violetas"), ("Residencia", "San Lorenzo"),
    ("Casa de Reposo", "Santa Isabel"), ("ELEAM", "Los Naranjos"),
    ("Residencia", "El Sauce"), ("Hogar", "Las Dalias"),
    ("Casa de Reposo", "San Pedro"), ("Residencia", "Santa Mónica"),
    ("ELEAM", "Los Almendros"), ("Hogar", "El Peral"),
    ("Casa de Reposo", "Las Encinas"), ("Residencia", "San Marcos"),
    ("Hogar", "Santa Lucía"), ("ELEAM", "Los Olivos"),
]

FIRST_NAMES_F = [
    "María Soledad", "Carmen Gloria", "Patricia", "Ana María", "Claudia",
    "Verónica", "Marcela", "Paulina", "Jacqueline", "Ximena", "Rosa",
    "Daniela", "Camila", "Fernanda", "Javiera", "Constanza", "Valentina",
    "Bárbara", "Pamela", "Andrea", "Nataly", "Solange", "Mónica", "Elizabeth",
]

FIRST_NAMES_M = [
    "Juan Carlos", "Luis", "Sergio", "Rodrigo", "Cristián", "Felipe",
    "Matías", "Ignacio", "Álvaro", "Mauricio", "Gonzalo", "Patricio",
    "Esteban", "Nicolás", "Diego", "Óscar", "Ramón", "Andrés",
]

SURNAMES = [
    "González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras",
    "Silva", "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López",
    "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza",
    "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez", "Castro",
    "Vargas", "Álvarez", "Vásquez", "Sandoval", "Cortés", "Bustos",
    "Riquelme", "Fernández", "Carrasco", "Miranda", "Herrera", "Bravo",
    "Figueroa", "Vergara", "Salazar", "Aguilera", "Ramírez", "Peña",
]

# Customer-success owners. Raimundo carries the book today - the whole point of
# the product is that this list can grow without him being the bottleneck.
OWNERS = ["Raimundo Mujica", "Carlos Flores", "Francisco Santibáñez"]

TICKET_SUBJECTS = [
    ("No puedo cerrar el checklist del turno noche", "Cannot close the night shift checklist", "checklist"),
    ("Error al imprimir la ficha clínica en PDF", "Error printing the clinical record as PDF", "ficha_clinica"),
    ("Se duplicó la dosis en tratamiento de un residente", "Duplicated dose on a resident treatment", "tratamientos"),
    ("Solicito capacitación para TENS nuevas", "Training request for newly hired nursing technicians", None),
    ("El apoderado no recibe el correo de acceso", "Family member is not receiving the access email", "apoderados"),
    ("No aparece la cama 12 en el mapa de piso 2", "Bed 12 missing from the floor 2 map", "habitaciones"),
    ("El informe mensual no cuadra con la cobranza", "Monthly report does not reconcile with billing", "reporteria"),
    ("Necesito exportar evaluaciones Barthel del trimestre", "Need to export quarterly Barthel assessments", "evaluaciones"),
    ("Cómo registro un egreso por fallecimiento", "How do I register a discharge due to death", "ingresos_egresos"),
    ("La app se cierra sola en la tablet del segundo piso", "App crashes on the second floor tablet", None),
    ("Falta un servicio de podología en la boleta", "Podiatry service missing from the invoice", "productos_servicios"),
    ("Preparación de carpeta para fiscalización SEREMI", "Preparing the folder for the SEREMI inspection", "auditorias"),
]

# WhatsApp / call log lines, in the register Raimundo actually uses with
# residence directors. Kept bilingual so the timeline reads in either locale.
INTERACTIONS = [
    ("Coordinamos capacitación para el equipo de enfermería.", "Coordinated training for the nursing team.", "whatsapp"),
    ("Consulta por el cierre de mes en reportería.", "Question about month-end close in reporting.", "whatsapp"),
    ("Avisan que cambió la enfermera jefe.", "They report the head nurse has changed.", "whatsapp"),
    ("Solicitan habilitar el portal para 4 apoderados nuevos.", "Requested family portal access for 4 new relatives.", "whatsapp"),
    ("Visita presencial: revisión de uso por módulo.", "On-site visit: module-by-module usage review.", "visita"),
    ("Llamada de seguimiento tras baja de actividad.", "Follow-up call after a drop in activity.", "llamada"),
    ("Confirman fiscalización SEREMI para el próximo mes.", "They confirm a SEREMI inspection next month.", "whatsapp"),
    ("Piden ayuda para cargar residentes nuevos.", "Asked for help loading newly admitted residents.", "whatsapp"),
    ("Feedback positivo del checklist en turno noche.", "Positive feedback on the night shift checklist.", "whatsapp"),
    ("Reportan lentitud en tablets del primer piso.", "Reported slowness on first floor tablets.", "whatsapp"),
    ("Evalúan ampliar licencias por nuevo pabellón.", "Considering more licences for a new wing.", "llamada"),
    ("Sin respuesta al último mensaje enviado.", "No reply to the last message sent.", "whatsapp"),
]
