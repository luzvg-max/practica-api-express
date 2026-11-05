
-- Base de datos de la practica 2.3
CREATE DATABASE IF NOT EXISTS api_practica;

USE api_practica;

-- Tabla para almacenar los libros
CREATE TABLE IF NOT EXISTS libros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    autor VARCHAR(150) NOT NULL,
    categoria VARCHAR(100) NOT NULL
);

-- Consultar los registros
SELECT * FROM libros;
