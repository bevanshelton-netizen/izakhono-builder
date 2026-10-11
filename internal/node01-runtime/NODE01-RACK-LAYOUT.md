# NODE01 Rack Layout

## Logical rack order
1. Top: network/management patching and labeling.
2. NODE01 2U chassis in a service-accessible position.
3. PDU feeds arranged so PSU-A and PSU-B use independent paths where the facility supports it.
4. UPS-backed power distribution below/adjacent to the server according to rack standards.
5. Separate backup appliance/storage positioned in a distinct failure domain where practical.

## Cabling rules
- Management/BMC cable: dedicated management switch/VLAN.
- Production NIC-A: production network path A.
- Production NIC-B: production network path B.
- PSU-A and PSU-B: independent power paths where available.
- Label both ends of every cable with node, interface and destination.
- Maintain service loops without obstructing airflow.

## Network separation
Management, production/edge, workload and backup traffic are separate logical zones. The NODE01 host must not depend on the public Internet for local control-plane operation.

## Physical completion
The rack layout is complete only after cable labels, port map, power map and BMC reachability have been recorded in the commissioning record.
