//! Cross-platform in-memory NEAR VM host environment (`near-sys` symbols) for running
//! `logen-vault` and `logen-registry` tests natively on Windows, macOS, and Linux without
//! requiring Unix-only `near-vm-runner` / `rustix`.
//!
//! Never compiled on `wasm32-unknown-unknown`.

use std::cell::RefCell;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct MockContext {
    pub current_account_id: String,
    pub signer_account_id: String,
    pub predecessor_account_id: String,
    pub input: Vec<u8>,
    pub block_index: u64,
    pub block_timestamp: u64,
    pub epoch_height: u64,
    pub account_balance: u128,
    pub account_locked_balance: u128,
    pub attached_deposit: u128,
    pub prepaid_gas: u64,
    pub storage_usage: u64,
    pub registers: HashMap<u64, Vec<u8>>,
    pub storage: HashMap<Vec<u8>, Vec<u8>>,
    pub logs: Vec<String>,
    pub return_data: Vec<u8>,
    pub next_promise_id: u64,
}

impl Default for MockContext {
    fn default() -> Self {
        Self {
            current_account_id: "logen.testnet".to_string(),
            signer_account_id: "alice.testnet".to_string(),
            predecessor_account_id: "alice.testnet".to_string(),
            input: Vec::new(),
            block_index: 1,
            block_timestamp: 1_700_000_000_000_000_000,
            epoch_height: 1,
            account_balance: 100 * 10u128.pow(24),
            account_locked_balance: 0,
            attached_deposit: 0,
            prepaid_gas: 300_000_000_000_000,
            storage_usage: 500,
            registers: HashMap::new(),
            storage: HashMap::new(),
            logs: Vec::new(),
            return_data: Vec::new(),
            next_promise_id: 1,
        }
    }
}

thread_local! {
    static CTX: RefCell<MockContext> = RefCell::new(MockContext::default());
}

/// Configures the thread-local mock NEAR blockchain context for the next contract call.
pub fn set_context(
    current_account_id: impl Into<String>,
    predecessor_account_id: impl Into<String>,
    attached_deposit: u128,
    account_balance: u128,
    block_timestamp: u64,
) {
    let cur = current_account_id.into();
    let pred = predecessor_account_id.into();
    CTX.with(|c| {
        let mut m = c.borrow_mut();
        m.current_account_id = cur;
        m.signer_account_id = pred.clone();
        m.predecessor_account_id = pred;
        m.attached_deposit = attached_deposit;
        m.account_balance = account_balance;
        m.block_timestamp = block_timestamp;
        m.return_data.clear();
    });
}

pub fn take_logs() -> Vec<String> {
    CTX.with(|c| std::mem::take(&mut c.borrow_mut().logs))
}

unsafe fn slice_from_guest<'a>(len: u64, ptr: u64) -> &'a [u8] {
    if len == 0 {
        &[]
    } else {
        std::slice::from_raw_parts(ptr as usize as *const u8, len as usize)
    }
}

unsafe fn write_u128_le(ptr: u64, val: u128) {
    let dst = std::slice::from_raw_parts_mut(ptr as usize as *mut u8, 16);
    dst.copy_from_slice(&val.to_le_bytes());
}

fn set_reg(reg_id: u64, bytes: Vec<u8>) {
    CTX.with(|c| {
        c.borrow_mut().registers.insert(reg_id, bytes);
    });
}

#[no_mangle]
pub unsafe extern "C" fn read_register(register_id: u64, ptr: u64) {
    CTX.with(|c| {
        if let Some(buf) = c.borrow().registers.get(&register_id) {
            if !buf.is_empty() {
                let dst = std::slice::from_raw_parts_mut(ptr as usize as *mut u8, buf.len());
                dst.copy_from_slice(buf);
            }
        }
    });
}

#[no_mangle]
pub extern "C" fn register_len(register_id: u64) -> u64 {
    CTX.with(|c| {
        c.borrow()
            .registers
            .get(&register_id)
            .map(|b| b.len() as u64)
            .unwrap_or(u64::MAX)
    })
}

#[no_mangle]
pub unsafe extern "C" fn write_register(register_id: u64, data_len: u64, data_ptr: u64) {
    set_reg(register_id, slice_from_guest(data_len, data_ptr).to_vec());
}

#[no_mangle]
pub extern "C" fn current_account_id(register_id: u64) {
    let s = CTX.with(|c| c.borrow().current_account_id.as_bytes().to_vec());
    set_reg(register_id, s);
}

#[no_mangle]
pub extern "C" fn signer_account_id(register_id: u64) {
    let s = CTX.with(|c| c.borrow().signer_account_id.as_bytes().to_vec());
    set_reg(register_id, s);
}

#[no_mangle]
pub extern "C" fn signer_account_pk(register_id: u64) {
    set_reg(register_id, vec![0u8; 33]);
}

#[no_mangle]
pub extern "C" fn predecessor_account_id(register_id: u64) {
    let s = CTX.with(|c| c.borrow().predecessor_account_id.as_bytes().to_vec());
    set_reg(register_id, s);
}

#[no_mangle]
pub extern "C" fn input(register_id: u64) {
    let inp = CTX.with(|c| c.borrow().input.clone());
    set_reg(register_id, inp);
}

#[no_mangle]
pub extern "C" fn block_index() -> u64 {
    CTX.with(|c| c.borrow().block_index)
}

#[no_mangle]
pub extern "C" fn block_timestamp() -> u64 {
    CTX.with(|c| c.borrow().block_timestamp)
}

#[no_mangle]
pub extern "C" fn epoch_height() -> u64 {
    CTX.with(|c| c.borrow().epoch_height)
}

#[no_mangle]
pub extern "C" fn storage_usage() -> u64 {
    CTX.with(|c| c.borrow().storage_usage)
}

#[no_mangle]
pub unsafe extern "C" fn account_balance(balance_ptr: u64) {
    let b = CTX.with(|c| c.borrow().account_balance);
    write_u128_le(balance_ptr, b);
}

#[no_mangle]
pub unsafe extern "C" fn account_locked_balance(balance_ptr: u64) {
    let b = CTX.with(|c| c.borrow().account_locked_balance);
    write_u128_le(balance_ptr, b);
}

#[no_mangle]
pub unsafe extern "C" fn attached_deposit(balance_ptr: u64) {
    let d = CTX.with(|c| c.borrow().attached_deposit);
    write_u128_le(balance_ptr, d);
}

#[no_mangle]
pub extern "C" fn prepaid_gas() -> u64 {
    CTX.with(|c| c.borrow().prepaid_gas)
}

#[no_mangle]
pub extern "C" fn used_gas() -> u64 {
    1_000_000_000
}

#[no_mangle]
pub extern "C" fn random_seed(register_id: u64) {
    set_reg(register_id, vec![7u8; 32]);
}

#[no_mangle]
pub unsafe extern "C" fn sha256(value_len: u64, value_ptr: u64, register_id: u64) {
    let data = slice_from_guest(value_len, value_ptr);
    // Deterministic 32-byte digest for host unit tests
    let mut out = [0u8; 32];
    for (i, &b) in data.iter().enumerate() {
        out[i % 32] = out[i % 32].wrapping_mul(31).wrapping_add(b);
    }
    set_reg(register_id, out.to_vec());
}

#[no_mangle]
pub unsafe extern "C" fn keccak256(value_len: u64, value_ptr: u64, register_id: u64) {
    sha256(value_len, value_ptr, register_id);
}

#[no_mangle]
pub unsafe extern "C" fn keccak512(value_len: u64, value_ptr: u64, register_id: u64) {
    let _ = slice_from_guest(value_len, value_ptr);
    set_reg(register_id, vec![0u8; 64]);
}

#[no_mangle]
pub unsafe extern "C" fn ripemd160(value_len: u64, value_ptr: u64, register_id: u64) {
    let _ = slice_from_guest(value_len, value_ptr);
    set_reg(register_id, vec![0u8; 20]);
}

#[no_mangle]
pub unsafe extern "C" fn value_return(value_len: u64, value_ptr: u64) {
    let v = slice_from_guest(value_len, value_ptr).to_vec();
    CTX.with(|c| c.borrow_mut().return_data = v);
}

#[no_mangle]
pub unsafe extern "C" fn panic_utf8(len: u64, ptr: u64) -> ! {
    let bytes = slice_from_guest(len, ptr);
    let msg = String::from_utf8_lossy(bytes).into_owned();
    panic!("{msg}");
}

#[no_mangle]
pub extern "C" fn panic() -> ! {
    panic!("explicit guest panic");
}

#[no_mangle]
pub unsafe extern "C" fn log_utf8(len: u64, ptr: u64) {
    let bytes = slice_from_guest(len, ptr);
    let msg = String::from_utf8_lossy(bytes).into_owned();
    CTX.with(|c| c.borrow_mut().logs.push(msg));
}

#[no_mangle]
pub unsafe extern "C" fn log_utf16(_len: u64, _ptr: u64) {}

#[no_mangle]
pub extern "C" fn promise_create(
    _account_id_len: u64,
    _account_id_ptr: u64,
    _method_name_len: u64,
    _method_name_ptr: u64,
    _arguments_len: u64,
    _arguments_ptr: u64,
    _amount_ptr: u64,
    _gas: u64,
) -> u64 {
    CTX.with(|c| {
        let mut m = c.borrow_mut();
        let id = m.next_promise_id;
        m.next_promise_id += 1;
        id
    })
}

#[no_mangle]
pub extern "C" fn promise_then(
    promise_index: u64,
    _account_id_len: u64,
    _account_id_ptr: u64,
    _method_name_len: u64,
    _method_name_ptr: u64,
    _arguments_len: u64,
    _arguments_ptr: u64,
    _amount_ptr: u64,
    _gas: u64,
) -> u64 {
    promise_index + 1
}

#[no_mangle]
pub extern "C" fn promise_and(_promise_idx_ptr: u64, _promise_idx_count: u64) -> u64 {
    CTX.with(|c| {
        let mut m = c.borrow_mut();
        let id = m.next_promise_id;
        m.next_promise_id += 1;
        id
    })
}

#[no_mangle]
pub extern "C" fn promise_batch_create(_account_id_len: u64, _account_id_ptr: u64) -> u64 {
    CTX.with(|c| {
        let mut m = c.borrow_mut();
        let id = m.next_promise_id;
        m.next_promise_id += 1;
        id
    })
}

#[no_mangle]
pub extern "C" fn promise_batch_then(
    promise_index: u64,
    _account_id_len: u64,
    _account_id_ptr: u64,
) -> u64 {
    promise_index + 1
}

#[no_mangle]
pub extern "C" fn promise_batch_action_create_account(_promise_index: u64) {}

#[no_mangle]
pub extern "C" fn promise_batch_action_deploy_contract(
    _promise_index: u64,
    _code_len: u64,
    _code_ptr: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_batch_action_function_call(
    _promise_index: u64,
    _method_name_len: u64,
    _method_name_ptr: u64,
    _arguments_len: u64,
    _arguments_ptr: u64,
    _amount_ptr: u64,
    _gas: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_batch_action_function_call_weight(
    _promise_index: u64,
    _method_name_len: u64,
    _method_name_ptr: u64,
    _arguments_len: u64,
    _arguments_ptr: u64,
    _amount_ptr: u64,
    _gas: u64,
    _weight: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_batch_action_transfer(_promise_index: u64, _amount_ptr: u64) {}

#[no_mangle]
pub extern "C" fn promise_batch_action_stake(
    _promise_index: u64,
    _amount_ptr: u64,
    _public_key_len: u64,
    _public_key_ptr: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_batch_action_add_key_with_full_access(
    _promise_index: u64,
    _public_key_len: u64,
    _public_key_ptr: u64,
    _nonce: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_batch_action_add_key_with_function_call(
    _promise_index: u64,
    _public_key_len: u64,
    _public_key_ptr: u64,
    _nonce: u64,
    _allowance_ptr: u64,
    _receiver_id_len: u64,
    _receiver_id_ptr: u64,
    _method_names_len: u64,
    _method_names_ptr: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_batch_action_delete_key(
    _promise_index: u64,
    _public_key_len: u64,
    _public_key_ptr: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_batch_action_delete_account(
    _promise_index: u64,
    _beneficiary_id_len: u64,
    _beneficiary_id_ptr: u64,
) {
}

#[no_mangle]
pub extern "C" fn promise_results_count() -> u64 {
    0
}

#[no_mangle]
pub extern "C" fn promise_result(_result_idx: u64, _register_id: u64) -> u64 {
    0
}

#[no_mangle]
pub extern "C" fn promise_return(_promise_id: u64) {}

#[no_mangle]
pub unsafe extern "C" fn storage_write(
    key_len: u64,
    key_ptr: u64,
    value_len: u64,
    value_ptr: u64,
    register_id: u64,
) -> u64 {
    let k = slice_from_guest(key_len, key_ptr).to_vec();
    let v = slice_from_guest(value_len, value_ptr).to_vec();
    let prev = CTX.with(|c| c.borrow_mut().storage.insert(k, v));
    if let Some(old) = prev {
        set_reg(register_id, old);
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn storage_read(key_len: u64, key_ptr: u64, register_id: u64) -> u64 {
    let k = slice_from_guest(key_len, key_ptr);
    let found = CTX.with(|c| c.borrow().storage.get(k).cloned());
    if let Some(v) = found {
        set_reg(register_id, v);
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn storage_remove(key_len: u64, key_ptr: u64, register_id: u64) -> u64 {
    let k = slice_from_guest(key_len, key_ptr);
    let prev = CTX.with(|c| c.borrow_mut().storage.remove(k));
    if let Some(old) = prev {
        set_reg(register_id, old);
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn storage_has_key(key_len: u64, key_ptr: u64) -> u64 {
    let k = slice_from_guest(key_len, key_ptr);
    CTX.with(|c| u64::from(c.borrow().storage.contains_key(k)))
}

#[no_mangle]
pub extern "C" fn ed25519_verify(
    _sig_len: u64,
    _sig_ptr: u64,
    _msg_len: u64,
    _msg_ptr: u64,
    _pub_key_len: u64,
    _pub_key_ptr: u64,
) -> u64 {
    1
}

#[no_mangle]
pub extern "C" fn ecrecover(
    _hash_len: u64,
    _hash_ptr: u64,
    _sig_len: u64,
    _sig_ptr: u64,
    _v: u64,
    _malleability_flag: u64,
    _register_id: u64,
) -> u64 {
    0
}

#[no_mangle]
pub extern "C" fn alt_bn128_g1_multiexp(_value_len: u64, _value_ptr: u64, _register_id: u64) {}

#[no_mangle]
pub extern "C" fn alt_bn128_g1_sum(_value_len: u64, _value_ptr: u64, _register_id: u64) {}

#[no_mangle]
pub extern "C" fn alt_bn128_pairing_check(_value_len: u64, _value_ptr: u64) -> u64 {
    0
}

#[no_mangle]
pub extern "C" fn promise_yield_create(
    _method_name_len: u64,
    _method_name_ptr: u64,
    _arguments_len: u64,
    _arguments_ptr: u64,
    _gas: u64,
    _gas_weight: u64,
    _register_id: u64,
) -> u64 {
    0
}

#[no_mangle]
pub extern "C" fn promise_yield_resume(
    _data_id_len: u64,
    _data_id_ptr: u64,
    _payload_len: u64,
    _payload_ptr: u64,
) -> u32 {
    0
}

#[no_mangle]
pub unsafe extern "C" fn validator_stake(_account_id_len: u64, _account_id_ptr: u64, stake_ptr: u64) {
    write_u128_le(stake_ptr, 0);
}

#[no_mangle]
pub unsafe extern "C" fn validator_total_stake(stake_ptr: u64) {
    write_u128_le(stake_ptr, 0);
}
