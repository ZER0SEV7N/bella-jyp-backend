DO $$ 
DECLARE 
    v_doc_id uuid := gen_random_uuid();
    v_est_id uuid := gen_random_uuid();
    v_area_id uuid := gen_random_uuid();
    v_cargo_id uuid := gen_random_uuid();
    v_emp_id uuid := gen_random_uuid();
BEGIN 
    -- 1. Crear Catálogos Base
    INSERT INTO tipo_documento (id, tipo_documento) VALUES (v_doc_id, 'DNI');
    INSERT INTO estado_empleado (id, descripcion) VALUES (v_est_id, 'ACTIVO');
    INSERT INTO area (id, nombre, activo) VALUES (v_area_id, 'Sistemas', true);
    
    -- 2. Crear Cargo enlazado al Área
    INSERT INTO cargo (id, id_area, nombre, activo) 
    VALUES (v_cargo_id, v_area_id, 'Arquitecto de Software', true);

    -- 3. Crear Empleado enlazando todo lo anterior
    INSERT INTO empleados (id, cargo_id, area_id, documento_id, estado_empleado_id, nombre, apellido, nro_documento, activo) 
    VALUES (v_emp_id, v_cargo_id, v_area_id, v_doc_id, v_est_id, 'Dylan', 'Desarrollador', '12345678', true);
END $$;