
require('dotenv').config();

const express = require('express');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

