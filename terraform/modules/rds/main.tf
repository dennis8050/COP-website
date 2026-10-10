resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "db" {
  name        = "${var.name}-rds"
  vpc_id      = var.vpc_id
  description = "Only Lambda can connect to PostgreSQL"
}

resource "aws_vpc_security_group_ingress_rule" "lambda" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = var.lambda_sg_id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_db_parameter_group" "this" {
  name   = var.name
  family = "postgres17"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

}

resource "aws_db_instance" "this" {
  identifier                      = var.name
  engine                          = "postgres"
  engine_version                  = "17"
  instance_class                  = var.instance_size
  allocated_storage               = 20
  max_allocated_storage           = 100
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = var.database_name
  username                        = var.username
  manage_master_user_password     = true
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.db.id]
  parameter_group_name            = aws_db_parameter_group.this.name
  publicly_accessible             = false
  multi_az                        = var.production
  backup_retention_period         = var.production ? 14 : 3
  deletion_protection             = var.production
  skip_final_snapshot             = !var.production
  final_snapshot_identifier       = "${var.name}-final"
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

