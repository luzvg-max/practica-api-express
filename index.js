
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./config/db');

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configuración de almacenamiento de archivos con Multer
const almacenamiento = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        cb(null, `archivo-${Date.now()}${extension}`);
    }

});

// Configuración de Multer
const upload = multer({
    storage: almacenamiento,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const extension = path.extname(file.originalname).toLowerCase();

        if (extension === '.json' || extension === '.csv') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos JSON y CSV'));
        }

    }
});


// GET - Consultar todos los libros
app.get('/api/recursos', async (req, res) => {
    try {
        const [libros] = await db.query(
            'SELECT * FROM libros'
        );
        res.status(200).json(libros);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al consultar los libros'
        });
    }
});


// Función para leer archivos CSV
function leerArchivoCSV(ruta) {
    return new Promise((resolve, reject) => {

        const registros = [];

        fs.createReadStream(ruta)
            .pipe(csv())
            .on('data', (fila) => {
                registros.push(fila);
            })
            .on('end', () => {
                resolve(registros);
            })
            .on('error', (error) => {
                reject(error);
            });

    });
}



// POST - Importar libros desde archivos JSON o CSV
app.post('/api/recursos/importar', upload.single('archivo'), async (req, res) => {

    let conexion;

    try {

        // Verificar que se haya enviado un archivo
        if (!req.file) {
            return res.status(400).json({
                mensaje: 'Debes seleccionar un archivo JSON o CSV'
            });
        }

        // Obtener la extensión del archivo original
        const extension = path.extname(req.file.originalname).toLowerCase();

        let registros = [];

        // Leer archivo JSON
        if (extension === '.json') {

            const contenido = await fs.promises.readFile(
                req.file.path,
                'utf8'
            );

            registros = JSON.parse(contenido);

        }

        // Leer archivo CSV
        else if (extension === '.csv') {

            registros = await leerArchivoCSV(req.file.path);

        }

        // Validar que el contenido sea un arreglo
        else {
            return res.status(400).json({
                mensaje: 'Formato de archivo no permitido'
            });
        }

        if (!Array.isArray(registros)) {
            return res.status(400).json({
                mensaje: 'El archivo debe contener una lista de libros'
            });
        }

        if (registros.length === 0) {
            return res.status(400).json({
                mensaje: 'El archivo no contiene registros'
            });
        }

        // Validar los campos de cada libro
        const libros = registros.map((libro) => {

            const nombre = String(libro.nombre || '').trim();
            const autor = String(libro.autor || '').trim();
            const categoria = String(libro.categoria || '').trim();

            if (!nombre || !autor || !categoria) {
                throw new Error(
                    'Todos los libros deben tener nombre, autor y categoria'
                );
            }

            return { nombre, autor, categoria };

        });

        // Obtener conexión y comenzar transacción
        conexion = await db.getConnection();
        await conexion.beginTransaction();

        // Consultar libros existentes
        const [existentes] = await conexion.query(
            'SELECT nombre, autor FROM libros'
        );

        // Normalizar texto para comparar nombres y autores
        const normalizar = (texto) => texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();

        // Crear conjunto de libros existentes
        const librosExistentes = new Set(
            existentes.map(libro =>
                `${normalizar(libro.nombre)}|${normalizar(libro.autor)}`
            )
        );

        // Identificar libros nuevos
        const nuevos = [];

        for (const libro of libros) {

            const clave = `${normalizar(libro.nombre)}|${normalizar(libro.autor)}`;

            if (!librosExistentes.has(clave)) {
                nuevos.push(libro);
                librosExistentes.add(clave);
            }

        }

        // Insertar únicamente los libros nuevos
        if (nuevos.length > 0) {

            const valores = nuevos.map(libro => [
                libro.nombre,
                libro.autor,
                libro.categoria
            ]);

            const placeholders = nuevos
                .map(() => '(?, ?, ?)')
                .join(', ');

            const parametros = valores.flat();

            await conexion.query(
                `INSERT INTO libros (nombre, autor, categoria) VALUES ${placeholders}`,
                parametros
            );

        }

        // Confirmar transacción
        await conexion.commit();

        // Responder con el resultado
        res.status(200).json({
            mensaje: 'Importación realizada correctamente',
            totalRecibidos: registros.length,
            insertados: nuevos.length,
            omitidos: registros.length - nuevos.length
        });

} catch (error) {

    if (conexion) {
        await conexion.rollback();
    }

    console.error('Error al importar archivos:', error);

    const esErrorCliente =
        error instanceof SyntaxError ||
        error.message.includes('Todos los libros deben tener');

    res.status(esErrorCliente ? 400 : 500).json({
        mensaje: 'Error al procesar el archivo',
        error: error.message
    });

} finally {

        // Eliminar archivo temporal
        if (req.file) {
            try {
                await fs.promises.unlink(req.file.path);
            } catch (error) {
                console.error('No se pudo eliminar el archivo temporal:', error);
            }
        }

        if (conexion) {
            conexion.release();
        }

    }

});


// GET - Consultar libro por ID
app.get('/api/recursos/:id', async (req, res) => {
    try {
        const [libros] = await db.query(
            'SELECT * FROM libros WHERE id = ?',
            [req.params.id]
        );

        if (libros.length === 0) {
            return res.status(404).json({
                mensaje: 'Libro no encontrado'
            });
        }

        res.status(200).json(libros[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al consultar el libro'
        });
    }
});

// POST - Registrar un libro
app.post('/api/recursos', async (req, res) => {
    try {
        const { nombre, autor, categoria } = req.body;

        if (!nombre || !autor || !categoria) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        const [resultado] = await db.query(
            'INSERT INTO libros (nombre, autor, categoria) VALUES (?, ?, ?)',
            [nombre, autor, categoria]
        );

        res.status(201).json({
            mensaje: 'Libro registrado correctamente',
            id: resultado.insertId,
            nombre,
            autor,
            categoria
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al registrar el libro'
        });
    }
});

// PUT - Actualizar un libro
app.put('/api/recursos/:id', async (req, res) => {
    try {
        const { nombre, autor, categoria } = req.body;

        if (!nombre || !autor || !categoria) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        const [resultado] = await db.query(
            'UPDATE libros SET nombre = ?, autor = ?, categoria = ? WHERE id = ?',
            [nombre, autor, categoria, req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Libro no encontrado'
            });
        }

        res.status(200).json({
            mensaje: 'Libro actualizado correctamente'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al actualizar el libro'
        });
    }
});

// DELETE - Eliminar un libro
app.delete('/api/recursos/:id', async (req, res) => {
    try {
        const [resultado] = await db.query(
            'DELETE FROM libros WHERE id = ?',
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Libro no encontrado'
            });
        }

        res.status(200).json({
            mensaje: 'Libro eliminado correctamente'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al eliminar el libro'
        });
    }
});


// Endpoint para exportar libros en formato JSON o CSV
app.get('/api/recursos/exportar/:formato', async (req, res) => {
    const formato = req.params.formato.toLowerCase();

    // Validar el formato solicitado
    if (formato !== 'json' && formato !== 'csv') {
        return res.status(400).json({
            mensaje: 'Formato no válido. Utiliza json o csv.'
        });
    }

    let conexion;

    try {
        // Obtener conexión a MySQL
        conexion = await db.getConnection();

        // Consultar todos los libros
        const [libros] = await conexion.query(
            'SELECT id, nombre, autor, categoria FROM libros ORDER BY id'
        );

        // Exportar en formato JSON
        if (formato === 'json') {
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="libros.json"'
            );
            res.setHeader('Content-Type', 'application/json; charset=utf-8');

            return res.status(200).json(libros);
        }

        // Exportar en formato CSV
        const encabezados = ['id', 'nombre', 'autor', 'categoria'];

        const escaparCSV = (valor) => {
            const texto = String(valor ?? '');
            return `"${texto.replace(/"/g, '""')}"`;
        };

        const filas = libros.map(libro =>
            encabezados.map(campo => escaparCSV(libro[campo])).join(',')
        );

        const contenidoCSV = [
            encabezados.join(','),
            ...filas
        ].join('\r\n');

        res.setHeader(
            'Content-Disposition',
            'attachment; filename="libros.csv"'
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');

        return res.status(200).send('\uFEFF' + contenidoCSV);

    } catch (error) {
        console.error('Error al exportar los libros:', error);

        return res.status(500).json({
            mensaje: 'Error al exportar los libros'
        });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});



// Verificar conexión antes de iniciar el servidor
async function iniciarServidor() {
    try {
        const conexion = await db.getConnection();
        console.log('Conectado exitosamente a MySQL');
        conexion.release();

        app.listen(PORT, () => {
            console.log(
                `Servidor ejecutándose en http://localhost:${PORT}`
            );
        });
    } catch (error) {
        console.error('Error de conexión a MySQL:', error.message);
        process.exit(1);
    }
}

iniciarServidor();

