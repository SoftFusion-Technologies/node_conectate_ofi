/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 /2025
 * Versión: 1.1
 *
 * Descripción:
 * Este archivo (routes.js) define las rutas HTTP para operaciones CRUD en las tablas
 *
 * Tema: Rutas 
 *
 * Capa: Backend
 */

import express from 'express';
const router = express.Router();

import { authenticateToken } from '../Security/auth.js';

// ----------------------------------------------------------------
// Importar controladores de sucursales (antes: locales)
// ----------------------------------------------------------------
import {
  OBRS_Sucursales_CTS,
  OBR_Sucursal_CTS,
  CR_Sucursal_CTS,
  ER_Sucursal_CTS,
  UR_Sucursal_CTS
} from '../Controllers/Core/CTS_TB_Sucursales.js';

// ----------------------------------------------------------------
// Importar controladores de usuarios
// ----------------------------------------------------------------
import {
  OBRS_Usuarios_CTS,
  OBR_Usuario_CTS,
  CR_Usuario_CTS,
  ER_Usuario_CTS,
  UR_Usuario_CTS
} from '../Controllers/Core/CTS_TB_Usuarios.js';

// ----------------------------------------------------------------
// Rutas para operaciones CRUD en la tabla 'sucursales'
// (si querés, después le agregamos authenticateToken a todas)
// ----------------------------------------------------------------

// Obtener todas las sucursales (con o sin paginado/filtros)
router.get('/sucursales', OBRS_Sucursales_CTS);

// Obtener una sucursal por ID
router.get('/sucursales/:id', OBR_Sucursal_CTS);

// Crear una nueva sucursal
router.post('/sucursales', CR_Sucursal_CTS);

// Eliminar una sucursal por ID
router.delete('/sucursales/:id', ER_Sucursal_CTS);

// Actualizar una sucursal por ID
router.put('/sucursales/:id', UR_Sucursal_CTS);

// ----------------------------------------------------------------
// Rutas para operaciones CRUD en la tabla 'usuarios'
// (todas protegidas con authenticateToken)
// ----------------------------------------------------------------

router.post('/usuarios', authenticateToken, CR_Usuario_CTS);
router.put('/usuarios/:id', authenticateToken, UR_Usuario_CTS);
router.delete('/usuarios/:id', authenticateToken, ER_Usuario_CTS);
router.get('/usuarios', authenticateToken, OBRS_Usuarios_CTS);
router.get('/usuarios/:id', authenticateToken, OBR_Usuario_CTS);

export default router;
