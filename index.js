
const express = require('express');

const app = express();
const PORT = 3000;

// Permite recibir y procesar solicitudes en formato JSON
app.use(express.json());

// Catálogo de libros almacenado en memoria
let libros = [
    {
        id: 1,
        nombre: 'Cien años de soledad',
        autor: 'Gabriel García Márquez',
        categoria: 'Novela'
    },
    {
        id: 2,
        nombre: 'Don Quijote de la Mancha',
        autor: 'Miguel de Cervantes',
        categoria: 'Clásico'
    },
    {
        id: 3,
        nombre: 'El principito',
        autor: 'Antoine de Saint-Exupéry',
        categoria: 'Fábula'
    }
];

// Ruta base: comprobar que el servidor está funcionando
app.get('/', (req, res) => {
    res.send('Servidor API REST funcionando correctamente');
});

// GET: obtener todos los libros
app.get('/api/recursos', (req, res) => {
    res.status(200).json(libros);
});

// GET: obtener un libro por su ID
app.get('/api/recursos/:id', (req, res) => {
    const id = Number(req.params.id);
    const libro = libros.find(l => l.id === id);

    if (!libro) {
        return res.status(404).json({
            mensaje: 'Libro no encontrado'
        });
    }

    res.status(200).json(libro);
});

// POST: registrar un libro nuevo
app.post('/api/recursos', (req, res) => {
    const { nombre, autor, categoria } = req.body;

    if (
        typeof nombre !== 'string' || !nombre.trim() ||
        typeof autor !== 'string' || !autor.trim() ||
        typeof categoria !== 'string' || !categoria.trim()
    ) {
        return res.status(400).json({
            mensaje: 'Debes proporcionar nombre, autor y categoria'
        });
    }

    const nuevoId = libros.length > 0
        ? Math.max(...libros.map(l => l.id)) + 1
        : 1;

    const nuevoLibro = {
        id: nuevoId,
        nombre: nombre.trim(),
        autor: autor.trim(),
        categoria: categoria.trim()
    };

    libros.push(nuevoLibro);

    res.status(201).json(nuevoLibro);
});

// PUT: actualizar un libro existente
app.put('/api/recursos/:id', (req, res) => {
    const id = Number(req.params.id);
    const indice = libros.findIndex(l => l.id === id);

    if (indice === -1) {
        return res.status(404).json({
            mensaje: 'Libro no encontrado'
        });
    }

    const { nombre, autor, categoria } = req.body;

    if (
        typeof nombre !== 'string' || !nombre.trim() ||
        typeof autor !== 'string' || !autor.trim() ||
        typeof categoria !== 'string' || !categoria.trim()
    ) {
        return res.status(400).json({
            mensaje: 'Debes proporcionar nombre, autor y categoria'
        });
    }

    libros[indice] = {
        id,
        nombre: nombre.trim(),
        autor: autor.trim(),
        categoria: categoria.trim()
    };

    res.status(200).json(libros[indice]);
});

// DELETE: eliminar un libro
app.delete('/api/recursos/:id', (req, res) => {
    const id = Number(req.params.id);
    const indice = libros.findIndex(l => l.id === id);

    if (indice === -1) {
        return res.status(404).json({
            mensaje: 'Libro no encontrado'
        });
    }

    libros.splice(indice, 1);

    res.status(200).json({
        mensaje: `Libro con ID ${id} eliminado correctamente`
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});