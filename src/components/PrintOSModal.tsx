// components/PrintOSModal.tsx

import Modal from "./Modal";

interface Props {
    maintenance: any;
    onClose: () => void;
}

export default function PrintOSModal({
    maintenance,
    onClose
}: Props) {

    const imprimir = () => {
        window.print();
    };

    return (
        <Modal onClose={onClose} size="large">

            <div id="ordem-servico">

                <h2>ORDEM DE SERVIÇO</h2>

                <p><strong>Cliente:</strong> {maintenance.customer}</p>

                <p><strong>Telefone:</strong> {maintenance.phone}</p>

                <p><strong>Aparelho:</strong> {maintenance.device}</p>

                <p><strong>Marca:</strong> {maintenance.brand}</p>

                <p><strong>Modelo:</strong> {maintenance.model}</p>

                <p><strong>Problema:</strong> {maintenance.issue}</p>

                <p><strong>Valor:</strong> R$ {maintenance.value}</p>

                <p><strong>Observações:</strong> {maintenance.notes}</p>

            </div>

            <div className="mt-6 flex justify-end gap-2">
                <button
                    onClick={imprimir}
                    className="bg-primary text-white px-4 py-2 rounded"
                >
                    Imprimir
                </button>
            </div>

        </Modal>
    );
}