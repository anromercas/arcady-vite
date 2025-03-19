import { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface Reserva {
  nombre: string;
  email: string;
  dni: string;
  telefono: string;
  tramoHorario: string;
  diaSeleccionado: string;
  aceptaNormas: boolean;
  palomitero: boolean;
  algodonAzucar: boolean;
}
// Configura Moment.js para que use español y que la semana empiece el lunes
moment.locale('es');
moment.updateLocale('es', {
  week: {
    dow: 1, // Lunes es el primer día de la semana
  },
});
const localizer = momentLocalizer(moment);

const formats = {
  dayFormat: 'dddd',
  weekdayFormat: 'ddd',
  monthHeaderFormat: 'MMMM YYYY',
  dayHeaderFormat: 'dddd, MMMM DD, YYYY',
  agendaDateFormat: 'dddd, MMMM DD'
};

const tramosHorarios = [
  { label: '10:00 - 22:00', startHour: 10, endHour: 22 },
  { label: '10:00 - 15:00', startHour: 10, endHour: 15 },
  { label: '17:00 - 22:00', startHour: 17, endHour: 22 },
  { label: '18:00 - 23:00', startHour: 18, endHour: 23 },
];

// Endpoint para obtener reservas
// const RESERVAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwclDYmwMtZjlUHk070xsrMpHCfKo_0fKE8neNy3mHgB_ztJvstlKtn06xNJ-JVP8Y2/exec';
const RESERVAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw0b2KgTQpYaob_e0fU2IS5fgu0pY14zBMvpEOaoz-LNoM8PipJ0QpLqk5XztpKJ-KgGw/exec';

export default function CalendarioReservas() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);
  const [tramoSeleccionado, setTramoSeleccionado] = useState<string | null>(null);
  const [formData, setFormData] = useState<Reserva>({
    nombre: '',
    email: '',
    dni: '',
    telefono: '',
    tramoHorario: '',
    diaSeleccionado: '',
    aceptaNormas: false,
    palomitero: false,
    algodonAzucar: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reservasData, setReservasData] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const navigate = useNavigate();

  // Formateo consistente de fecha "YYYY-MM-DD"
  const formatDateKey = (date: Date) =>
    `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`;

  const fetchReservas = useCallback(async () => {
    try {
      const response = await fetch(RESERVAS_ENDPOINT);
      if (!response.ok) throw new Error('Error al obtener reservas');
      const data = await response.json();
      const raw: Reserva[] = data.raw || [];
      setReservasData(raw);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservas();
  }, [fetchReservas]);

  // Agrupa reservas por día
  const aggregatedMap = reservasData.reduce((acc: { [key: string]: string[] }, reserva) => {
    // Convertir la cadena ISO a Date y formatearla de forma consistente
    const key = formatDateKey(new Date(reserva.diaSeleccionado));
    if (key) {
      if (!acc[key]) acc[key] = [];
      acc[key].push(reserva.tramoHorario);
    }
    return acc;
  }, {});

  // Determina el estado del día
  const getDayStatus = (date: Date) => {
    const key = formatDateKey(date);
    const slots: string[] = aggregatedMap[key] || [];
    if (slots.length === 0) return 'libre';
    if (slots.includes('10:00 - 22:00')) return 'ocupado';
    if (
      slots.includes('10:00 - 15:00') &&
      (slots.includes('17:00 - 22:00') || slots.includes('18:00 - 23:00'))
    )
      return 'ocupado';
    return 'parcial';
  };

  const handleDayClick = (date: Date) => {
    const status = getDayStatus(date);
    if (status === 'ocupado') {
      toast.error('El día está completamente ocupado. No se pueden reservar franjas.');
      resetForm();
      return;
    }

    // Si la fecha seleccionada es hoy o anterior, no permitimos la reserva
    if (moment(date).isSameOrBefore(moment(), 'day')) {
      toast.error('Solo se pueden reservar días futuros.');
      resetForm();
      return;
    }

    setFechaSeleccionada(date);
    setTramoSeleccionado(null);
    setFormData({
      ...formData,
      diaSeleccionado: formatDateKey(date),
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    setErrors({ ...errors, [name]: '' });
  };

  const handleTramoSeleccionado = (tramo: string) => {
    setTramoSeleccionado(tramo);
    setFormData({
      ...formData,
      tramoHorario: tramo,
    });
  };

  const validarFormulario = () => {
    const nuevosErrores: Record<string, string> = {};
    if (!formData.nombre.trim())
      nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!formData.email.trim())
      nuevosErrores.email = 'El email es obligatorio';
    if (!formData.dni.trim())
      nuevosErrores.dni = 'El DNI es obligatorio';
    if (!formData.telefono.trim())
      nuevosErrores.telefono = 'El teléfono es obligatorio';
    if (!formData.aceptaNormas)
      nuevosErrores.aceptaNormas = 'Debes aceptar las normas y políticas';

    const nameRegex = /^[A-Za-zÀ-ÿ\s]+$/;
    if (!nameRegex.test(formData.nombre)) {
      nuevosErrores.nombre = 'El nombre solo debe contener letras y espacios';
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      nuevosErrores.email = 'El email es obligatorio';
    } else if (!emailRegex.test(formData.email)) {
      nuevosErrores.email = 'El formato del email es inválido';
    }

    // Validación de DNI (8 dígitos + una letra)
    const dniRegex = /^\d{8}[A-Za-z]$/;
    if (!formData.dni.trim()) {
      nuevosErrores.dni = 'El DNI es obligatorio';
    } else if (!dniRegex.test(formData.dni)) {
      nuevosErrores.dni = 'El formato del DNI es inválido';
    }

    // Validación de teléfono (9 dígitos)
    const telefonoRegex = /^\d{9}$/;
    if (!formData.telefono.trim()) {
      nuevosErrores.telefono = 'El teléfono es obligatorio';
    } else if (!telefonoRegex.test(formData.telefono)) {
      nuevosErrores.telefono = 'El formato del teléfono es inválido';
    }

    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const reservarEvento = async () => {
    if (!fechaSeleccionada) {
      toast.error('Selecciona una fecha antes de reservar.');
      return;
    }
    if (!tramoSeleccionado) {
      toast.error('Selecciona un tramo horario antes de reservar.');
      return;
    }
    if (!validarFormulario()) {
      toast.error('Por favor, revisa el formulario.');
      return;
    }

    try {
      setLoading(true);
      const result = await agregarReserva(formData);
      if (result.error !== undefined) {
        toast.error(result.error);
      } else {
        resetForm();
        toast.success('Reserva realizada con éxito 🎉');
      }
      await fetchReservas();
      setLoading(false);
    } catch (error) {
      console.error('Error guardando reserva:', error);
      toast.error('Error al reservar. Intenta de nuevo.');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      email: '',
      dni: '',
      telefono: '',
      tramoHorario: '',
      diaSeleccionado: '',
      aceptaNormas: false,
      palomitero: false,
      algodonAzucar: false,
    });
    setFechaSeleccionada(null);
    setTramoSeleccionado(null);
  }

  const agregarReserva = async (reserva: Reserva) => {
    try {
      const params = new URLSearchParams();
      params.append('nombre', reserva.nombre);
      params.append('email', reserva.email);
      params.append('dni', reserva.dni);
      params.append('telefono', reserva.telefono);
      params.append('diaSeleccionado', reserva.diaSeleccionado);
      params.append('tramoHorario', reserva.tramoHorario);
      params.append('aceptaNormas', reserva.aceptaNormas ? 'true' : 'false');
      params.append('palomitero', reserva.palomitero ? 'true' : 'false');
      params.append('algodonAzucar', reserva.algodonAzucar ? 'true' : 'false');

      params.append('fechaReserva', new Date().toISOString().split('T')[0]);

      const response = await fetch(
        RESERVAS_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          // body: JSON.stringify(reserva),
        }
      );
      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Error al agregar reserva:', error);
      throw error;
    }
  };

  // dayPropGetter asigna estilos a cada día:
  // - Si es el día seleccionado, lo pinta en verde.
  // - Si no, utiliza getDayStatus para aplicar gris sólido o rayado.
  const dayPropGetter = (date: Date) => {
    if (fechaSeleccionada && moment(date).isSame(fechaSeleccionada, 'day')) {
      return {
        style: {
          backgroundColor: '#4CAF50',
          color: 'white',
        },
      };
    }
    const status = getDayStatus(date);
    if (status === 'ocupado') {
      return {
        style: {
          backgroundColor: 'gray',
          color: 'white',
        },
      };
    }
    if (status === 'parcial') {
      return {
        style: {
          backgroundImage:
            'repeating-linear-gradient(45deg, #ccc, #ccc 5px, #fff 5px, #fff 10px)',
        },
      };
    }
    return {};
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ToastContainer position="top-right" autoClose={3000} />
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#20c997]"></div>
      </div>
    );
  }

  // Función auxiliar para determinar si un tramo está reservado, considerando la complementariedad
  const isSlotReserved = (slot: string, reservedSlots: string[]): boolean => {
    if (slot === '17:00 - 22:00' || slot === '18:00 - 23:00') {
      return reservedSlots.includes('17:00 - 22:00') || reservedSlots.includes('18:00 - 23:00');
    }
    return reservedSlots.includes(slot);
  };

  // Calcula los tramos reservados para el día seleccionado
  const reservedSlots =
    fechaSeleccionada && aggregatedMap[formatDateKey(fechaSeleccionada)]
      ? aggregatedMap[formatDateKey(fechaSeleccionada)]
      : [];

  const dayStatus = fechaSeleccionada ? getDayStatus(fechaSeleccionada) : 'libre';

  const availableSlots = tramosHorarios.filter((tramo) => {
    // Si el día está parcialmente ocupado, no mostramos el tramo completo
    if (dayStatus === 'parcial' && tramo.label === '10:00 - 22:00') {
      return false;
    }
    return !isSlotReserved(tramo.label, reservedSlots);
  });

  const messages = {
    previous: 'Anterior',
    next: 'Siguiente',
    today: 'Hoy',
  };

  return (
    <div className="flex flex-col items-center p-4">
      <ToastContainer position="top-right" autoClose={3000} />

      <h2 className="text-xl font-bold text-center mb-4">
        Selecciona una fecha
      </h2>
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-xl">
        <Calendar
          localizer={localizer}
          culture="es"
          formats={formats}
          views={{ month: true }}
          onSelectSlot={(slotInfo) => handleDayClick(slotInfo.start)}
          selectable
          style={{ height: 400 }}
          dayPropGetter={dayPropGetter}
          messages={messages}
        />
      </div>

      <div className="mt-4 flex justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-300 border"></div>
          <span>Día disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-400 bg-[repeating-linear-gradient(45deg,_#ccc,_#ccc_5px,_#fff_5px,_#fff_10px)] border"></div>
          <span>Día parcialmente ocupado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-600 border"></div>
          <span>Día completamente ocupado</span>
        </div>
      </div>

      {fechaSeleccionada && (
        <div className="mt-4 text-center">
          <h3 className="text-lg font-semibold">
            Tramos disponibles para {moment(fechaSeleccionada).format('LL')}
          </h3>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {availableSlots.map((tramo) => {
              return (
                <button
                  key={tramo.label}
                  className={`px-4 py-2 rounded-md transition ${tramoSeleccionado === tramo.label
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-black hover:bg-gray-400'
                    }`}
                  onClick={() => handleTramoSeleccionado(tramo.label)}
                >
                  {tramo.label}
                </button>
              )
            })}
          </div>

          <form className="mt-6 max-w-lg mx-auto text-left">
            {['nombre', 'email', 'dni', 'telefono'].map((field) => (
              <div key={field} className="mb-2">
                <label className="block">
                  {field === 'nombre'
                    ? 'Nombre y Apellidos:'
                    : `${field.charAt(0).toUpperCase() + field.slice(1)}:`}
                </label>
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  name={field}
                  value={(formData as any)[field]}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded mt-1 ${errors[field] ? 'border-red-500' : ''
                    }`}
                  required
                />
                {errors[field] && (
                  <p className="text-red-500 text-sm">{errors[field]}</p>
                )}
              </div>
            ))}

            <label className="flex items-center mt-2">
              <input
                type="checkbox"
                name="aceptaNormas"
                checked={formData.aceptaNormas}
                onChange={handleChange}
                className="mr-2"
              />
              <span>
                Acepto las{' '}
                <span
                  className="text-blue-500 cursor-pointer"
                  onClick={() => navigate('/normas-uso')}
                >
                  normas de uso
                </span>{' '}
                y la{' '}
                <span
                  className="text-blue-500 cursor-pointer"
                  onClick={() => navigate('/politica-privacidad')}
                >
                  política de privacidad
                </span>
              </span>
            </label>
            {errors.aceptaNormas && (
              <p className="text-red-500 text-sm">{errors.aceptaNormas}</p>
            )}

            <label className="flex items-center mt-4">
              <input
                type="checkbox"
                name="palomitero"
                checked={formData.palomitero}
                onChange={handleChange}
                className="mr-2"
              />
              <span>
                Añadir <strong>Palomitero</strong> (+10€)
              </span>
            </label>

            <label className="flex items-center mt-2">
              <input
                type="checkbox"
                name="algodonAzucar"
                checked={formData.algodonAzucar}
                onChange={handleChange}
                className="mr-2"
              />
              <span>
                Añadir <strong>Máquina de Algodón de Azúcar</strong> (+10€)
              </span>
            </label>
            <button
              type="button"
              className="w-full text-center mt-5 bg-[#20c997] hover:bg-[#1ba884] text-white font-bold py-3 px-8 rounded-full shadow-md transition-colors"
              onClick={reservarEvento}
            >
              Reservar
            </button>
          </form>

        </div>
      )}
      <div className="mt-12 text-center max-w-4xl mx-auto">
        <h4 className="text-xl font-semibold mb-4">Confirmación y Formas de Pago</h4>
        <p>Para confirmar tu reserva, <strong>se requiere un depósito de 75 €</strong>, que deberá abonarse en las <strong>24 horas</strong> siguientes a la solicitud. Este importe será reembolsado al día siguiente del evento, tras verificar el cumplimiento de nuestras normas y condiciones.</p>
        <ul className="mt-4 text-left inline-block">
          <li><strong>Bizum:</strong> al número 655 312 918</li>
          <li><strong>Transferencia bancaria:</strong>
            <ul className="ml-4">
              <li>IBAN: ES7021007789310200093283</li>
              <li>Concepto: Nombre completo y fecha/hora de la reserva</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
