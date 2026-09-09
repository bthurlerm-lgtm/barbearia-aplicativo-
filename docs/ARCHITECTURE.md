# ARCHITECTURE

## Estado atual
Scaffold estático sem backend para validar UX e reduzir custo inicial.

## Próxima arquitetura
Camadas:
- presentation
- application/domain
- persistence
- integrations

Entidades mínimas:
Tenant, User, Barber, Service, AvailabilityRule, Booking, Customer.

## Invariantes
- isolamento de tenant;
- nenhuma credencial secreta no frontend;
- horário só confirma após operação transacional;
- booking não pode sobrepor outro booking válido do mesmo barbeiro;
- duração do serviço participa do cálculo de conflito.

## Próximo P0
APP-003 deve escolher a persistência de menor custo suficiente e preparar APP-004/005 sem overengineering.
