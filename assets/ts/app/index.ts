import * as app from "./app";
import * as api from "./../model/api/api";
import { Group, Participant } from "../model/group";
import { buildParticipantsTransferMovements, Movement, TransferMovement } from "../model/movement";
import { newPrice, parsePrice, Price, stringifyPrice, zeroValue } from "../model/price";
interface UIGroup extends Group {
  participants: Participant[];
  movements: Movement[];

}
async function renderGroups(appState: app.State) {
  const groupList = document.getElementById('group-list');
  groupList.innerHTML = '';
  const groups: UIGroup[] = Object.values(appState.groupById).map(group => {
    return {
      id: group.id,
      name: group.name,
      participants: [],
      movements: [],
    }
  }); // dev notes: The map creates a copy since the group object is modified below  (note how the participants and movements properties are defined)
  (groups || []).forEach(async group => {
    group.participants = await app.fetchParticipants(group.id)
    group.movements = await app.fetchMovements(group.id)
    var movementDetailsByMovementId: {[movementId: number]: string} = {};
    await Promise.all(
      (group.movements || []).map(async (movement) => {
        const participantsMovements = await app.fetchParticipantMovements(movement.id)
        const details = participantsMovements.reduce((acc, participantMovement, index, array) => {
          const participantString = `${appState.participantById[participantMovement.participantId].name}: ${stringifyPrice(participantMovement.amount)}`;
          if (index < array.length - 1) {
            return acc + participantString + "<br/> ";
          }
          return acc + participantString;
        }, '');
        movementDetailsByMovementId[movement.id] = details
      })
    );
    const groupDiv = document.createElement('div');
    groupDiv.className = 'group';
    groupDiv.innerHTML = `
      <b>${group.name}</b>
      <button class="remove-group-btn" data-group-id="${group.id}">❌</button>
      <div style="align-self: flex-start;">
        <div>💰 Movimientos</div>
        <ol style="padding-inline-start: 1em;" id="movements-list-${group.id}">
          ${(group.movements || []).map(movement => `
            <li style="display: flex; align-items: center; justify-content: space-between; margin: 0.5em 0;">
              <div>
                <!-- <span style="color: grey;">${formatUnixTimestamp(movement.createdAt)}</span><br/> -->
                <b style="color: blue;">${movement.concept}</b> (total ${stringifyPrice(movement.amount)})<br/>
                ${movementDetailsByMovementId[movement.id]}
              </div>
              <button class="remove-movement-btn" data-movement-id="${movement.id}">❌</button>
            </li>
          `).join('')}
        </ol>
        <button class="open-movement-modal-btn">Cargar Movimiento<br/>➕💰</button>
        <button class="open-transfer-modal-btn">Cargar Transferencia<br/>➕💵</button>
      </div>
      <div style="align-self: flex-start;">
        <div>👥 Participantes</div>
        <ul style="padding-inline-start: 1em;" id="participant-list-${group.id}">
          ${(group.participants || []).map(participant => `
            <li style="display: flex; align-items: center; justify-content: space-between; margin: 0.5em 0;">
              <span>${participant.name}</span>
              <button class="remove-participant-btn" data-participant-id="${participant.id}">❌</button>
            </li>
          `).join('')}
        </ul>
        <button class="open-participant-modal-btn">Agregar Participante<br/>➕👥</button>
      </div>
      <div>
        <button class="open-aggregated-balances-modal-btn">Calcular balances<br/>🧮📊</button>
      </div>
    `;
    groupDiv.dataset.groupId = group.id.toString()
    groupList.appendChild(groupDiv);
  });
}

function toggleModal(modalId: string) {
  const modal = document.getElementById(modalId);
  modal.classList.toggle('active');
}

function formatUnixTimestamp(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

document.getElementById('add-group-btn').addEventListener('click', () => {
  toggleModal('add-group-modal');
});

document.getElementById('add-group-confirm-btn').addEventListener('click',async () => {
  const groupNameInput: HTMLInputElement = document.getElementById('group-name-input') as HTMLInputElement
  const groupName = (groupNameInput.value || "").trim();
  if (groupName) {
    await app.createGroup(groupName);
    groupNameInput.value = ""
    toggleModal('add-group-modal');
    renderGroups(app.state);
  } else {
    alert('El nombre del grupo no puede estar vacio');
  }
});

document.querySelector("#add-group-modal button.close").addEventListener("click", () => {
  const groupNameInput: HTMLInputElement = document.getElementById('group-name-input') as HTMLInputElement
  groupNameInput.value = '';
  toggleModal('add-group-modal')
})

document.querySelector("#add-participant-modal button.close").addEventListener("click", () => {
  const participantNameInput: HTMLInputElement = document.getElementById('participant-name-input') as HTMLInputElement
  participantNameInput.value = '';
  toggleModal('add-participant-modal')
})

document.querySelector("#add-movement-modal button.close").addEventListener("click", () => {
  closeMovementModal()
})

document.querySelector("#add-transfer-modal button.close").addEventListener("click", () => {
  closeTransferModal()
})

document.getElementById('add-participant-movement-confirm-btn').onclick = () => {
  addParticipantMovement();
}

(document.querySelector('#display-aggregated-balance-modal button.close') as HTMLButtonElement).onclick = () => {
  toggleModal('display-aggregated-balance-modal')
}

document.getElementById('add-participant-confirm-btn').addEventListener('click', async () => {
  const participantNameInput: HTMLInputElement = document.getElementById('participant-name-input') as HTMLInputElement
  const name = participantNameInput.value.trim();
  if (name) {
    try {
      const groupId = +document.getElementById('add-participant-modal').dataset.groupId
      await app.addParticipant(name, groupId)
      participantNameInput.value = '';
      toggleModal('add-participant-modal');
      renderGroups(app.state);
    } catch (error) {
      alert(error)
    }
  } else {
    alert('El nombre del participante no puede estar vacio');
  }
});

// Delegación de eventos: el contenedor maneja los clicks de los botones hijos
document.getElementById("group-list").addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.matches(".open-participant-modal-btn")) {
    const groupElement = target.closest(".group") as HTMLElement;
    const groupId = +groupElement.dataset.groupId
    openParticipantModal(groupId);
    event.preventDefault();
    event.stopPropagation()
  }
  if (target.matches(".open-movement-modal-btn")) {
    const groupElement = target.closest(".group") as HTMLElement;
    const groupId = +groupElement.dataset.groupId
    openMovementModal(groupId, app.state);
    event.preventDefault();
    event.stopPropagation()
  }
  if (target.matches(".open-transfer-modal-btn")) {
    const groupElement = target.closest(".group") as HTMLElement;
    const groupId = +groupElement.dataset.groupId
    openTransferModal(groupId, app.state);
    event.preventDefault();
    event.stopPropagation()
  }
  if (target.matches(".open-aggregated-balances-modal-btn")) {
    const groupElement = target.closest(".group") as HTMLElement;
    const groupId = +groupElement.dataset.groupId
    openAggregatedBalancesModal(groupId, app.state)
    event.preventDefault();
    event.stopPropagation()
  }
  if (target.matches(".remove-group-btn")) {
    const groupId = +target.dataset.groupId
    deleteGroup(groupId)
    event.preventDefault();
    event.stopPropagation()
  }
  if (target.matches(".remove-movement-btn")) {
    const movementId = +target.dataset.movementId
    deleteMovement(movementId)
    event.preventDefault();
    event.stopPropagation()
  }
  if (target.matches(".remove-participant-btn")) {
    const participantId = +target.dataset.participantId
    deleteParticipant(participantId)
    event.preventDefault();
    event.stopPropagation()
  }
});

async function deleteGroup(groupId: number) {
  try {
    await app.deleteGroup(groupId)
    renderGroups(app.state);
    console.log('Group deleted successfully:', groupId);
  } catch (error) {
    console.error("Error deleting group:", error);
  }
}

async function deleteParticipant(participantId: number) {
  try {
    await app.deleteParticipant(participantId);
    renderGroups(app.state);
    console.log('Participant deleted successfully:', participantId);
  } catch (error) {
    if (error instanceof api.ParticipantDeletionError) {
      alert("No se puede eliminar el participante porque tiene movimientos asociados.\nPrimero eliminá los movimientos en los que está involucrado.");
    } else {
      console.error("Error deleting participant:", error);
    }
  }
}

async function deleteMovement(movementId: number) {
  try {
    await app.deleteMovement(movementId);
    renderGroups(app.state);
    console.log('Movement deleted successfully:', movementId);
  } catch (error) {
    console.error('Error deleting movement:', error);
  }
}

document.getElementById('add-movement-confirm-btn').addEventListener('click', async () => {
  const modal = document.getElementById('add-movement-modal');
  const concept = (document.getElementById('movement-concept-input') as HTMLInputElement).value;
  const totalAmount = (document.getElementById('movement-price-input') as HTMLInputElement).value;
  const items = Array.from(document.getElementById('participant-movement-list').children) as HTMLElement[]
  if (!concept || (items.length || 0) < 2) {
    alert("Por favor, carga el concepto y al menos dos contribuciones")
    return
  }

  const participantMovements: api.ParticipantMovement[] = [];
  for (let item of items) {
    const participantId = item.dataset.participantId;
    const price = parsePrice(item.dataset.price)
    participantMovements.push({
      participantId: +participantId,
      amount: price
    });
  }
  const groupId = +modal.dataset.groupId
  const movement: api.Movement = {
    groupId: groupId,
    amount: parsePrice(totalAmount),
    concept: concept,
    participantMovements: participantMovements
  };

  try {
    const m = await app.addMovement(movement);
    console.log('Movement added successfully:', m);
  } catch (error) {
    console.error('Error adding movement:', error);
  }

  closeMovementModal()
});


document.getElementById('add-transfer-confirm-btn').addEventListener('click', async () => {
  const modal = document.getElementById('add-transfer-modal');
  const concept = (document.getElementById('transfer-concept-input') as HTMLInputElement).value;
  const amount = (document.getElementById('transfer-price-input') as HTMLInputElement).value;
  const fromSelect = document.getElementById('from-participant-transfer-selector') as HTMLSelectElement;
  const toSelect = document.getElementById('to-participant-transfer-selector') as HTMLSelectElement;

  const fromParticipantId = +fromSelect.value;
  const toParticipantId = +toSelect.value;
  if (!fromParticipantId || !toParticipantId || fromParticipantId === toParticipantId) {
    alert("Se tienen que seleccionar dos participantes distintos.")
    return
  }

  // TODO: creo que tengo que extender la api! de acá abajo hay aoepraciones que son propias del dominio del problema
  const groupId = +modal.dataset.groupId
  const transferMovement: TransferMovement = {
    id: undefined,
    type: "transfer",
    groupId: groupId,
    createdAt: undefined,
    amount: parsePrice(amount),
    concept: concept,
    fromParticipantId: fromParticipantId,
    toParticipantId: toParticipantId,
  };

  try {
    const participantMovements = buildParticipantsTransferMovements(transferMovement);
    const movement: api.Movement = {
      groupId: transferMovement.groupId,
      amount: transferMovement.amount,
      concept: concept,
      participantMovements: participantMovements
    };
    const m = await app.addMovement(movement); // TODO: el tema es que  despues el a la hora de generar el balance usaria movements de tipo Movement
    console.log('Transfer added successfully:', m);
  } catch (error) {
    console.error('Error adding transfer:', error);
  }

  closeTransferModal()
});

function openParticipantModal(groupId: number) {
  const modal = document.getElementById('add-participant-modal');
  modal.dataset.groupId = groupId.toString();
  toggleModal('add-participant-modal');
}

function openMovementModal(groupId: number, appState: app.State) {
  const modal = document.getElementById('add-movement-modal');
  modal.dataset.groupId = groupId.toString();
  setupParticipantMovementModal(groupId, appState);
  toggleModal('add-movement-modal');
}

function openTransferModal(groupId: number, appState: app.State) {
  const modal = document.getElementById('add-transfer-modal');
  modal.dataset.groupId = groupId.toString();
  setupParticipantTransferModal(groupId, appState);
  toggleModal('add-transfer-modal');
}

interface HTMLParticipant extends Participant {
  price: Price
}

interface HTMLMovementModal extends HTMLElement {
  __selectedParticipants: {
    [particpantId: number]: HTMLParticipant
  }
}

async function setupParticipantMovementModal(groupId: number, appState: app.State) {
  const modal = document.getElementById('add-movement-modal') as HTMLMovementModal
  modal.__selectedParticipants = {};
  const participants = await app.fetchParticipants(groupId);
  await populateParticipantSelect('participant-movement-selector', participants, "Participante...");
}

async function setupParticipantTransferModal(groupId: number, appState: app.State) {
  const modal = document.getElementById('add-transfer-modal') as HTMLMovementModal;
  modal.__selectedParticipants = {};
  const participants = await app.fetchParticipants(groupId);
  await populateParticipantSelect('from-participant-transfer-selector', participants,"De participante..");
  await populateParticipantSelect('to-participant-transfer-selector', participants,"A participante...");
}

async function populateParticipantSelect(selectId: string, participants: Participant[], placeholder: string) {
  const select = document.getElementById(selectId) as HTMLSelectElement;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  (participants || []).forEach(participant => {
    addParticipantToSelect(select, participant);
  });
}

function addParticipantToSelect(select: HTMLSelectElement, participant: Participant) {
  const option = document.createElement('option');
  option.value = participant.id.toString();
  option.textContent = participant.name;
  select.appendChild(option);
}

function addParticipantMovement() {
  const modal = document.getElementById('add-movement-modal') as HTMLMovementModal;
  const select = document.getElementById('participant-movement-selector') as HTMLSelectElement;
  const priceInput = document.getElementById('participant-movement-price-input') as HTMLInputElement
  const list = document.getElementById('participant-movement-list');

  const participantId = +select.value;
  if (!participantId || !priceInput.value) {
    alert('Por favor, seleccioná un participante y especificá una contribución.');
    return;
  }
  const participantShare = parsePrice(priceInput.value.trim().replace(/\./g, ","));
  // add to list
  const participantName = select.options[select.selectedIndex].text;
  modal.__selectedParticipants[participantId] = { id: participantId, name: participantName, price: participantShare, groupId: undefined };
  const listItem = document.createElement('div');
  listItem.className = 'horizontal-layout';
  (listItem.style as any) = "align-items: center;"
  listItem.dataset.participantId = participantId.toString()
  listItem.dataset.price = stringifyPrice(participantShare)
  listItem.innerHTML = `
    <span>${participantName} (id: ${participantId}): ${stringifyPrice(participantShare)}</span>
    <button class="remove-btn">❌</button>
  `;
  listItem.querySelector('.remove-btn').addEventListener('click', () => {
    delete modal.__selectedParticipants[participantId];
    listItem.remove();
    addParticipantToSelect(select, { id: participantId, name: participantName, groupId: undefined });
    totalPriceInput.value = stringifyPrice(parsePrice(totalPriceInput.value).subtract(participantShare))
  });
  list.appendChild(listItem);

  priceInput.value = '';
  select.remove(select.selectedIndex);
  const totalPriceInput = document.getElementById('movement-price-input')as HTMLInputElement
  totalPriceInput.value = stringifyPrice(parsePrice(totalPriceInput.value || "0").add(participantShare))
}

function closeMovementModal() {
  const list = document.getElementById('participant-movement-list');
  list.innerHTML = "";
  (document.getElementById('movement-price-input') as HTMLInputElement).value = "";
  (document.getElementById('movement-concept-input') as HTMLInputElement).value = "";
  toggleModal('add-movement-modal');
  renderGroups(app.state);
}


function closeTransferModal() {
  (document.getElementById('transfer-price-input') as HTMLInputElement).value = "";
  (document.getElementById('transfer-concept-input') as HTMLInputElement).value = "";
  toggleModal('add-transfer-modal');
  renderGroups(app.state);
}


async function openAggregatedBalancesModal(groupId: number, appState: app.State) {
  const aggregatedBalance = await app.requestAggregatedBalances(groupId)

  const balance = aggregatedBalance.balance;
  const shares = aggregatedBalance.shares;

  const participantIds = Array.from(shares.keys()).map(Number)

  const headerRow = document.getElementById('balance-header-row');
  const participantThs = participantIds.map(id => `<th>${appState.participantById[id].name}</th>`).join("")
  headerRow.innerHTML = '<th>Participante</th>' + participantThs;

  const balanceBody = document.getElementById('balance-body');
  balanceBody.innerHTML = '';

  (participantIds || []).forEach(fromId => {
    let row = `<tr><td>${appState.participantById[fromId].name}</td>`;
    participantIds.forEach(toId => {
      if (fromId === toId) {
        row += '<td>-</td>';
      } else {
        const amount = balance.get(fromId)?.get(toId) || zeroValue();
        row += `<td>${stringifyPrice(amount)}</td>`;
      }
    });
    row += '</tr>';
    balanceBody.innerHTML += row;
  });

  const sharesBody = document.getElementById('shares-body');
  const sharesArray = Array.from(shares.entries())
  sharesBody.innerHTML = Array.from(sharesArray)
    .map(([participantId, amount]) => {
      var styles = "font-weight: 900; "
      if (amount.isLowerStrict(zeroValue())) {
        styles += "background-color: rgba(255, 0, 0, 0.6); color: black;"
      } else {
        styles += "background-color: rgba(0, 150, 0, 0.6); color: white;"
      }
      return `<tr><td>${appState.participantById[participantId].name}</td><td style="${styles}">${stringifyPrice(amount)}</td></tr>`
    })
    .join('');

  // TODO: creo que tengo que extender la api! isGroupSettled es un operación que corresponde modelizarla dentro dominio puro del problema (no en la UI)
  const isGroupSettled = sharesArray.reduce((acc, [participantId, amount]) => {
    return acc && amount.equals(zeroValue())
  }, true)
  document.getElementById("balanced-title").style.display = (isGroupSettled) ? "block" : "none"
  toggleModal("display-aggregated-balance-modal")
}

// start screen by rendedring the groups
renderGroups(app.state);